// --- 1. Ambient Background ---
    const particlesContainer = document.getElementById('particles');
    for (let i = 0; i < 30; i++) {
      let p = document.createElement('div');
      p.className = 'particle';
      let size = Math.random() * 5 + 2;
      p.style.width = size + 'px'; p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDuration = (Math.random() * 12 + 8) + 's';
      p.style.animationDelay = (Math.random() * 5) + 's';
      particlesContainer.appendChild(p);
    }

    // --- 2. State & Elements ---
    const scene = document.getElementById('scene');
    const wheelContainer = document.getElementById('wheel-container');
    const rotator = document.getElementById('wheel-rotator');
    const modal = document.getElementById('focusModal');
    const modalContent = document.getElementById('modalContent');
    const backBtn = document.getElementById('backBtn');
    const nodes = document.querySelectorAll('.wheel-node');

    let wheelIsOpen = false;
    let currentRotation = 0;
    let activeNode = null;

    // --- 3. Wheel Initialization ---
    function initWheel() {
      // Responsive radius
      const radius = Math.min(window.innerWidth * 0.35, window.innerHeight * 0.35, 160);

      nodes.forEach((node, i) => {
        const angle = (i / nodes.length) * 360;
        node.dataset.baseAngle = angle;

        // Position node around the circle
        node.style.transform = `rotate(${angle}deg) translate(${radius}px)`;

        // Stagger the pop-in animation
        const popWrap = node.querySelector('.node-pop-wrap');
        popWrap.style.transitionDelay = `${0.1 + i * 0.15}s`;
      });

      updateWheelRotation(currentRotation);
    }

    window.addEventListener('resize', initWheel);
    initWheel(); // Initial layout

    // --- 4. Central Trigger ---
    function toggleWheel(e) {
      if (e) e.stopPropagation();
      if (wheelIsOpen) {
        document.body.classList.remove('wheel-open');
        wheelIsOpen = false;
      } else {
        document.body.classList.add('wheel-open');
        wheelIsOpen = true;

        // Spawn hearts from center
        const rect = document.getElementById('centralTrigger').getBoundingClientRect();
        spawnHearts(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    }

    function spawnHearts(x, y) {
      const colors = ['#ff4d6d', '#ff758f', '#ff8fa3', '#ffb3c1'];
      for (let i = 0; i < 12; i++) {
        setTimeout(() => {
          let heart = document.createElement('div');
          heart.className = 'heart';
          heart.style.left = (x + (Math.random() - 0.5) * 100) + 'px';
          heart.style.top = (y + (Math.random() - 0.5) * 50) + 'px';
          heart.style.background = colors[Math.floor(Math.random() * colors.length)];
          heart.style.transform = `scale(${0.6 + Math.random() * 0.6}) rotate(45deg)`;
          document.body.appendChild(heart);
          setTimeout(() => heart.remove(), 3000);
        }, i * 80);
      }
    }

    // --- 5. Drag to Spin with Momentum ---
    let isDragging = false;
    let touchStartX, touchStartY, pointerDownTime;
    let startAngle = 0, lastAngle = 0, velocity = 0, lastTime = 0;
    let momentumFrame;

    function getAngle(x, y) {
      const rect = rotator.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      return Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
    }

    scene.addEventListener('pointerdown', e => {
      if (!wheelIsOpen || document.body.classList.contains('is-focusing')) return;
      // Ignore if clicking modal or central trigger
      if (e.target.closest('.focus-modal') || e.target.closest('.central-trigger')) return;

      isDragging = true;
      touchStartX = e.clientX;
      touchStartY = e.clientY;
      pointerDownTime = performance.now();

      startAngle = getAngle(e.clientX, e.clientY) - currentRotation;
      velocity = 0;
      lastAngle = currentRotation;
      lastTime = performance.now();
      cancelAnimationFrame(momentumFrame);
    });

    scene.addEventListener('pointermove', e => {
      if (!isDragging) return;

      const dist = Math.sqrt(Math.pow(e.clientX - touchStartX, 2) + Math.pow(e.clientY - touchStartY, 2));
      if (dist > 5) {
        // Confirm it's a drag
        e.preventDefault();
      }

      const newRot = getAngle(e.clientX, e.clientY) - startAngle;
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);

      let deltaA = newRot - lastAngle;
      // Shortest path
      if (deltaA > 180) deltaA -= 360;
      if (deltaA < -180) deltaA += 360;

      velocity = deltaA / dt;
      lastAngle = newRot;
      lastTime = now;

      updateWheelRotation(newRot);
    });

    window.addEventListener('pointerup', e => {
      if (!isDragging) return;
      isDragging = false;

      const dist = Math.sqrt(Math.pow(e.clientX - touchStartX, 2) + Math.pow(e.clientY - touchStartY, 2));
      const timeElapsed = performance.now() - pointerDownTime;

      // If very little movement and quick release, let click handler take it (it's a tap)
      if (dist > 10 || timeElapsed > 300) {
        applyMomentum(); // It was a drag, apply physics
      }
    });

    function applyMomentum() {
      if (Math.abs(velocity) > 0.02) {
        const newRot = currentRotation + velocity * 16;
        velocity *= 0.95; // Friction
        updateWheelRotation(newRot);
        momentumFrame = requestAnimationFrame(applyMomentum);
      }
    }

    function updateWheelRotation(deg) {
      currentRotation = deg;
      rotator.style.transform = `rotate(${deg}deg)`;

      // Counter-rotate the inner elements to keep them upright
      nodes.forEach(node => {
        const baseAngle = parseFloat(node.dataset.baseAngle);
        const inner = node.querySelector('.node-inner');
        if (inner) {
          inner.style.transform = `rotate(${-(baseAngle + deg)}deg)`;
        }
      });
    }

    // --- 6. Node Tap & Focus Mode (FLIP technique) ---
    function handleNodeClick(e, node) {
      // Check if this was a drag instead of a tap by checking our variables
      const dist = Math.sqrt(Math.pow(e.clientX - touchStartX, 2) + Math.pow(e.clientY - touchStartY, 2));
      if (dist > 10) return; // ignore, it was a drag

      focusNode(node);
    }

    function focusNode(node) {
      if (activeNode) return;
      activeNode = node;

      const inner = node.querySelector('.node-scale-wrap'); // Use the visible circle
      const rect = inner.getBoundingClientRect();
      const fullContentHtml = node.querySelector('.node-full-content').innerHTML;

      // Populate Modal
      modalContent.innerHTML = fullContentHtml;
      modalContent.scrollTop = 0; // Reset scroll

      // 1. Initial State (Match the clicked node exactly)
      modal.style.transition = 'none';
      modal.style.left = rect.left + 'px';
      modal.style.top = rect.top + 'px';
      modal.style.width = rect.width + 'px';
      modal.style.height = rect.height + 'px';
      modal.style.borderRadius = '50%';
      modal.classList.add('active');

      // Hide inner content initially
      modalContent.style.opacity = '0';
      backBtn.style.opacity = '0';

      // Force reflow to register initial state
      modal.offsetHeight;

      // 2. Target State (Center screen, expanded)
      const targetW = Math.min(500, window.innerWidth * 0.9);
      const targetH = Math.min(800, window.innerHeight * 0.85);
      const targetLeft = (window.innerWidth - targetW) / 2;
      const targetTop = (window.innerHeight - targetH) / 2;

      modal.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
      modal.style.left = targetLeft + 'px';
      modal.style.top = targetTop + 'px';
      modal.style.width = targetW + 'px';
      modal.style.height = targetH + 'px';
      modal.style.borderRadius = '16px';

      // Fade in content
      setTimeout(() => {
        modalContent.style.transition = 'opacity 0.3s ease';
        modalContent.style.opacity = '1';
        backBtn.style.transition = 'opacity 0.3s ease';
        backBtn.style.opacity = '1';
      }, 250);

      // Visual changes to background
      document.body.classList.add('is-focusing');
      wheelContainer.classList.add('blurred');
      document.getElementById('centralTrigger').classList.add('blurred');

      // Stop wheel spinning if it was
      velocity = 0;
      cancelAnimationFrame(momentumFrame);
    }

    function unfocusNode() {
      if (!activeNode) return;

      // Fade out content first
      modalContent.style.opacity = '0';
      backBtn.style.opacity = '0';

      setTimeout(() => {
        // Re-measure node in case of window resize
        const inner = activeNode.querySelector('.node-scale-wrap');
        const rect = inner.getBoundingClientRect();

        // Animate back to origin
        modal.style.left = rect.left + 'px';
        modal.style.top = rect.top + 'px';
        modal.style.width = rect.width + 'px';
        modal.style.height = rect.height + 'px';
        modal.style.borderRadius = '50%';

        document.body.classList.remove('is-focusing');
        wheelContainer.classList.remove('blurred');
        document.getElementById('centralTrigger').classList.remove('blurred');

        // Fully hide after animation completes
        setTimeout(() => {
          modal.classList.remove('active');
          activeNode = null;
          modalContent.innerHTML = '';
        }, 500);

      }, 200);
    }
