/* ============================================
   Ma Garage List — Application Logic
   ============================================ */

(function () {
    'use strict';

    // ---- State ----
    const STORAGE_KEY = 'garage-list-vehicles';
    const SETTINGS_KEY = 'garage-list-settings';
    let vehicles = [];
    let settings = { interestRate: 5.9, duration: 60 };
    let editingId = null;
    let deletingId = null;

    // ---- DOM References ----
    const $ = (sel) => document.querySelector(sel);
    const container = $('#vehicles-container');
    const emptyState = $('#empty-state');
    const modalOverlay = $('#modal-overlay');
    const confirmOverlay = $('#confirm-overlay');
    const form = $('#vehicle-form');
    const totalCountEl = $('#total-count');
    const totalPriceEl = $('#total-price');
    const interestInput = $('#interest-rate');
    const durationInput = $('#credit-duration');
    const priceInput = $('#vehicle-price');
    const creditPreviewValue = $('#credit-preview-value');
    const imageInput = $('#vehicle-image');
    const imagePreview = $('#image-preview');
    const imageUploadArea = $('#image-upload-area');
    const uploadPlaceholder = $('#upload-placeholder');
    const urlInput = $('#vehicle-url');

    // ---- Persistence ----
    function loadData() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) vehicles = JSON.parse(raw);
        } catch (e) {
            vehicles = [];
        }
        try {
            const raw = localStorage.getItem(SETTINGS_KEY);
            if (raw) {
                const s = JSON.parse(raw);
                settings.interestRate = s.interestRate ?? 5.9;
                settings.duration = s.duration ?? 60;
            }
        } catch (e) { /* keep defaults */ }
        interestInput.value = settings.interestRate;
        durationInput.value = settings.duration;
    }

    function saveVehicles() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicles));
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    // ---- Credit Calculation ----
    function calcMonthly(price) {
        const r = settings.interestRate / 100 / 12;
        const n = settings.duration;
        if (r === 0) return price / n;
        return price * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }

    function formatPrice(num) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'decimal',
            maximumFractionDigits: 0,
        }).format(num) + ' EUR';
    }

    function formatMonthly(num) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'decimal',
            maximumFractionDigits: 0,
        }).format(num) + ' EUR/mois';
    }

    // ---- Priority labels ----
    const priorityLabels = {
        1: 'Prochain achat',
        2: 'Court terme',
        3: 'Moyen terme',
        4: 'Long terme',
        5: 'Reve lointain',
    };

    // ---- Render ----
    function render() {
        // Sort by priority then by creation order
        const sorted = [...vehicles].sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.createdAt - b.createdAt;
        });

        container.innerHTML = '';
        if (sorted.length === 0) {
            emptyState.classList.add('show');
        } else {
            emptyState.classList.remove('show');
        }

        sorted.forEach((v, idx) => {
            const monthly = calcMonthly(v.price);
            const card = document.createElement('div');
            card.className = 'vehicle-card';
            card.dataset.id = v.id;

            const isFirst = idx === 0;
            const isLast = idx === sorted.length - 1;

            card.innerHTML = `
                <div class="vehicle-order">${idx + 1}</div>
                <div class="vehicle-image-wrapper">
                    ${v.image
                        ? `<img src="${escapeHtml(v.image)}" alt="${escapeHtml(v.name)}" loading="lazy">`
                        : `<div class="no-image">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <path d="M21 15l-5-5L5 21"/>
                            </svg>
                            <span>Pas d'image</span>
                        </div>`
                    }
                    <div class="image-overlay"></div>
                </div>
                <div class="vehicle-info">
                    <div class="vehicle-meta">
                        <span class="priority-badge priority-${v.priority}">${priorityLabels[v.priority] || ''}</span>
                        ${v.year ? `<span class="vehicle-year">${v.year}</span>` : ''}
                    </div>
                    <h2 class="vehicle-name">${escapeHtml(v.name)}</h2>
                    ${v.notes ? `<p class="vehicle-notes">${escapeHtml(v.notes)}</p>` : ''}
                    <div class="vehicle-pricing">
                        <div class="price-block">
                            <span class="price-label">Prix</span>
                            <span class="price-value">${formatPrice(v.price)}</span>
                        </div>
                        <div class="price-block">
                            <span class="price-label">Credit ${settings.duration} mois</span>
                            <span class="price-value monthly">${formatMonthly(monthly)}</span>
                        </div>
                    </div>
                    <div class="vehicle-actions">
                        <button class="btn-move" title="Monter" data-dir="up" data-id="${v.id}" ${isFirst ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        <button class="btn-move" title="Descendre" data-dir="down" data-id="${v.id}" ${isLast ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <button class="btn-edit" data-id="${v.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Modifier
                        </button>
                        <button class="btn-delete" data-id="${v.id}">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                            Supprimer
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(card);

            // Animate in with IntersectionObserver
            requestAnimationFrame(() => {
                observeCard(card);
            });
        });

        updateStats();
    }

    function updateStats() {
        totalCountEl.textContent = vehicles.length;
        const total = vehicles.reduce((sum, v) => sum + v.price, 0);
        totalPriceEl.textContent = formatPrice(total);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ---- Intersection Observer ----
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    function observeCard(card) {
        observer.observe(card);
    }

    // ---- Modal Logic ----
    function openModal(vehicle = null) {
        editingId = vehicle ? vehicle.id : null;
        $('#modal-title').textContent = vehicle ? 'Modifier le vehicule' : 'Ajouter un vehicule';
        $('#btn-submit-text').textContent = vehicle ? 'Enregistrer' : 'Ajouter le vehicule';

        $('#vehicle-id').value = vehicle ? vehicle.id : '';
        $('#vehicle-name').value = vehicle ? vehicle.name : '';
        $('#vehicle-year').value = vehicle ? (vehicle.year || '') : '';
        $('#vehicle-price').value = vehicle ? vehicle.price : '';
        $('#vehicle-url').value = vehicle ? (vehicle.imageUrl || '') : '';
        $('#vehicle-notes').value = vehicle ? (vehicle.notes || '') : '';
        $('#vehicle-priority').value = vehicle ? vehicle.priority : '1';

        // Reset image preview
        if (vehicle && vehicle.image) {
            imagePreview.src = vehicle.image;
            imageUploadArea.classList.add('has-image');
        } else {
            imagePreview.src = '';
            imageUploadArea.classList.remove('has-image');
        }
        imageInput.value = '';

        updateCreditPreview();
        modalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        setTimeout(() => $('#vehicle-name').focus(), 200);
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        editingId = null;
        form.reset();
        imagePreview.src = '';
        imageUploadArea.classList.remove('has-image');
    }

    function updateCreditPreview() {
        const price = parseFloat(priceInput.value) || 0;
        if (price > 0) {
            creditPreviewValue.textContent = formatMonthly(calcMonthly(price));
        } else {
            creditPreviewValue.textContent = '-- EUR/mois';
        }
    }

    // ---- Image handling ----
    function handleImageFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            // Resize to max 800px width to save localStorage space
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_W = 800;
                let w = img.width;
                let h = img.height;
                if (w > MAX_W) {
                    h = h * (MAX_W / w);
                    w = MAX_W;
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                imagePreview.src = dataUrl;
                imageUploadArea.classList.add('has-image');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    imageInput.addEventListener('change', (e) => {
        handleImageFile(e.target.files[0]);
    });

    // Drag & drop
    imageUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageUploadArea.style.borderColor = 'var(--accent-1)';
    });

    imageUploadArea.addEventListener('dragleave', () => {
        imageUploadArea.style.borderColor = '';
    });

    imageUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        imageUploadArea.style.borderColor = '';
        if (e.dataTransfer.files.length) {
            handleImageFile(e.dataTransfer.files[0]);
        }
    });

    // URL input fallback
    urlInput.addEventListener('change', () => {
        const url = urlInput.value.trim();
        if (url) {
            imagePreview.src = url;
            imageUploadArea.classList.add('has-image');
        }
    });

    // ---- Form Submit ----
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = $('#vehicle-name').value.trim();
        const year = parseInt($('#vehicle-year').value) || null;
        const price = parseFloat($('#vehicle-price').value) || 0;
        const notes = $('#vehicle-notes').value.trim();
        const priority = parseInt($('#vehicle-priority').value) || 1;
        const imageUrl = urlInput.value.trim();

        // Determine image source
        let image = '';
        if (imagePreview.src && imagePreview.src !== window.location.href && imagePreview.src !== '') {
            image = imagePreview.src;
        }

        if (!name || price <= 0) return;

        if (editingId) {
            const idx = vehicles.findIndex((v) => v.id === editingId);
            if (idx !== -1) {
                vehicles[idx] = {
                    ...vehicles[idx],
                    name,
                    year,
                    price,
                    notes,
                    priority,
                    image,
                    imageUrl,
                };
            }
        } else {
            vehicles.push({
                id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
                name,
                year,
                price,
                notes,
                priority,
                image,
                imageUrl,
                createdAt: Date.now(),
            });
        }

        saveVehicles();
        render();
        closeModal();
    });

    // ---- Delete ----
    function confirmDelete(id) {
        deletingId = id;
        confirmOverlay.classList.add('active');
    }

    $('#btn-confirm-delete').addEventListener('click', () => {
        if (deletingId) {
            vehicles = vehicles.filter((v) => v.id !== deletingId);
            saveVehicles();
            render();
        }
        confirmOverlay.classList.remove('active');
        deletingId = null;
    });

    $('#btn-cancel-delete').addEventListener('click', () => {
        confirmOverlay.classList.remove('active');
        deletingId = null;
    });

    // ---- Move / Reorder ----
    function moveVehicle(id, direction) {
        const sorted = [...vehicles].sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.createdAt - b.createdAt;
        });
        const idx = sorted.findIndex((v) => v.id === id);
        if (idx === -1) return;

        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;

        // Swap priorities and createdAt to change order
        const current = sorted[idx];
        const target = sorted[swapIdx];

        // If same priority, swap createdAt
        if (current.priority === target.priority) {
            const tmpCreated = current.createdAt;
            current.createdAt = target.createdAt;
            target.createdAt = tmpCreated;
        } else {
            // Swap priorities
            const tmpPriority = current.priority;
            current.priority = target.priority;
            target.priority = tmpPriority;
        }

        saveVehicles();
        render();
    }

    // ---- Event Delegation ----
    container.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.btn-edit');
        const deleteBtn = e.target.closest('.btn-delete');
        const moveBtn = e.target.closest('.btn-move');

        if (editBtn) {
            const v = vehicles.find((v) => v.id === editBtn.dataset.id);
            if (v) openModal(v);
        }
        if (deleteBtn) {
            confirmDelete(deleteBtn.dataset.id);
        }
        if (moveBtn) {
            moveVehicle(moveBtn.dataset.id, moveBtn.dataset.dir);
        }
    });

    // ---- Open Modal Buttons ----
    $('#btn-open-modal').addEventListener('click', () => openModal());
    $('#btn-add-first').addEventListener('click', () => openModal());
    $('#modal-close').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    confirmOverlay.addEventListener('click', (e) => {
        if (e.target === confirmOverlay) {
            confirmOverlay.classList.remove('active');
            deletingId = null;
        }
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (confirmOverlay.classList.contains('active')) {
                confirmOverlay.classList.remove('active');
                deletingId = null;
            } else if (modalOverlay.classList.contains('active')) {
                closeModal();
            }
        }
    });

    // ---- Settings ----
    interestInput.addEventListener('change', () => {
        settings.interestRate = parseFloat(interestInput.value) || 5.9;
        saveSettings();
        render();
        updateCreditPreview();
    });

    durationInput.addEventListener('change', () => {
        settings.duration = parseInt(durationInput.value) || 60;
        saveSettings();
        render();
        updateCreditPreview();
    });

    priceInput.addEventListener('input', updateCreditPreview);

    // ============================================
    // Three.js 3D Background
    // ============================================

    function initThreeBackground() {
        const canvas = document.getElementById('bg-canvas');
        if (!canvas || typeof THREE === 'undefined') return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 30;

        const renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: true,
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Particles
        const particleCount = 300;
        const particlesGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);

        const palette = [
            new THREE.Color(0x6366f1),
            new THREE.Color(0x8b5cf6),
            new THREE.Color(0xa78bfa),
            new THREE.Color(0x3b82f6),
        ];

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 60;

            const col = palette[Math.floor(Math.random() * palette.length)];
            colors[i * 3] = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;

            sizes[i] = Math.random() * 2 + 0.5;
        }

        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particlesGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const particleMaterial = new THREE.PointsMaterial({
            size: 0.15,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        const particles = new THREE.Points(particlesGeometry, particleMaterial);
        scene.add(particles);

        // Floating geometric shapes
        const shapes = [];
        const shapeMaterial = new THREE.MeshBasicMaterial({
            color: 0x6366f1,
            wireframe: true,
            transparent: true,
            opacity: 0.08,
        });

        // Icosahedrons
        for (let i = 0; i < 5; i++) {
            const geo = new THREE.IcosahedronGeometry(Math.random() * 3 + 1, 1);
            const mesh = new THREE.Mesh(geo, shapeMaterial.clone());
            mesh.material.opacity = 0.04 + Math.random() * 0.06;
            mesh.position.set(
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 30
            );
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            mesh.userData = {
                rotSpeed: {
                    x: (Math.random() - 0.5) * 0.003,
                    y: (Math.random() - 0.5) * 0.003,
                    z: (Math.random() - 0.5) * 0.003,
                },
                floatSpeed: Math.random() * 0.002 + 0.001,
                floatOffset: Math.random() * Math.PI * 2,
            };
            scene.add(mesh);
            shapes.push(mesh);
        }

        // Torus shapes
        for (let i = 0; i < 3; i++) {
            const geo = new THREE.TorusGeometry(Math.random() * 2 + 1, 0.3, 8, 24);
            const mesh = new THREE.Mesh(geo, shapeMaterial.clone());
            mesh.material.opacity = 0.03 + Math.random() * 0.05;
            mesh.material.color = new THREE.Color(0x8b5cf6);
            mesh.position.set(
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 50,
                (Math.random() - 0.5) * 20
            );
            mesh.userData = {
                rotSpeed: {
                    x: (Math.random() - 0.5) * 0.004,
                    y: (Math.random() - 0.5) * 0.004,
                    z: (Math.random() - 0.5) * 0.002,
                },
                floatSpeed: Math.random() * 0.002 + 0.001,
                floatOffset: Math.random() * Math.PI * 2,
            };
            scene.add(mesh);
            shapes.push(mesh);
        }

        // Lines / connections
        const linesMaterial = new THREE.LineBasicMaterial({
            color: 0x6366f1,
            transparent: true,
            opacity: 0.04,
        });

        const linesGeometry = new THREE.BufferGeometry();
        const linePositions = [];
        for (let i = 0; i < 40; i++) {
            const x1 = (Math.random() - 0.5) * 80;
            const y1 = (Math.random() - 0.5) * 80;
            const z1 = (Math.random() - 0.5) * 40;
            const x2 = x1 + (Math.random() - 0.5) * 20;
            const y2 = y1 + (Math.random() - 0.5) * 20;
            const z2 = z1 + (Math.random() - 0.5) * 20;
            linePositions.push(x1, y1, z1, x2, y2, z2);
        }
        linesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lines = new THREE.LineSegments(linesGeometry, linesMaterial);
        scene.add(lines);

        // Mouse interaction
        let mouseX = 0;
        let mouseY = 0;
        document.addEventListener('mousemove', (e) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
            mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
        });

        // Animation loop
        let time = 0;
        function animate() {
            requestAnimationFrame(animate);
            time += 0.01;

            // Rotate particles slowly
            particles.rotation.y += 0.0003;
            particles.rotation.x += 0.0001;

            // Animate shapes
            shapes.forEach((shape) => {
                shape.rotation.x += shape.userData.rotSpeed.x;
                shape.rotation.y += shape.userData.rotSpeed.y;
                shape.rotation.z += shape.userData.rotSpeed.z;
                shape.position.y += Math.sin(time * shape.userData.floatSpeed * 100 + shape.userData.floatOffset) * 0.01;
            });

            // Lines subtle rotation
            lines.rotation.y += 0.0002;
            lines.rotation.x += 0.0001;

            // Camera follows mouse gently
            camera.position.x += (mouseX * 3 - camera.position.x) * 0.02;
            camera.position.y += (-mouseY * 3 - camera.position.y) * 0.02;
            camera.lookAt(scene.position);

            renderer.render(scene, camera);
        }

        animate();

        // Handle resize
        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    // ---- Initialize ----
    loadData();
    render();
    initThreeBackground();
})();
