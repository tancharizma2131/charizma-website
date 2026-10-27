const headerHTML = `
<div class="container">
    <div class="header-flex">
<div class="header-socials">
    <a href="https://www.instagram.com/charizma.management/" target="_blank" rel="noopener noreferrer" aria-label="Charizma Management on Instagram" title="Instagram">
        <svg class="social-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg>
    </a>
</div>
        <a href="index.html" class="logo" aria-label="Charizma Management home"><img src="image/brand/charizma-clean.svg" alt="Charizma Management" width="1255" height="247"></a>
        <button class="hamburger" aria-label="Toggle navigation" aria-expanded="false" aria-controls="main-nav">
            <span class="bar"></span>
            <span class="bar"></span>
            <span class="bar"></span>
        </button>            
        <nav id="main-nav" aria-label="Main navigation">
            <ul>
                <li><a href="women.html">Women</a></li>
                <li><a href="men.html">Men</a></li>
                <li><a href="about.html">About</a></li>
                <li><a href="be-charizmatic.html">Be charizmatic</a></li>
            </ul>
        </nav>
    </div>
</div>
`;

const footerHTML = `
<div class="container">
    <p>&copy; <span id="footer-year"></span> Charizma Management <span class="footer-credit">&middot; Crafted by The Folio Lab</span></p>
</div>
`;

const modalHTML = `
<div id="imageModal" class="modal" role="dialog" aria-modal="true" aria-label="Image gallery" tabindex="-1">
  <button type="button" class="close-modal-btn" aria-label="Close image gallery">&times;</button>
  <button type="button" class="prev-btn modal-nav-btn" aria-label="Previous image">&#10094;</button>
  <button type="button" class="next-btn modal-nav-btn" aria-label="Next image">&#10095;</button>
  <div class="modal-content-wrapper">
    <div class="loading-indicator">
        <div class="spinner"></div>
    </div>
    <img class="modal-content" id="modalImage" alt="Enlarged view" style="display: none;">
  </div>
  <button type="button" class="modal-fullsize-link" aria-label="Expand comp card" aria-pressed="false" title="Expand comp card">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6" />
    </svg>
  </button>
  <a class="modal-download-link" href="#" download aria-label="Download comp card as PNG" title="Download PNG">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14" />
    </svg>
  </a>
</div>
`;

document.addEventListener('DOMContentLoaded', () => {
    const headerEl = document.querySelector('header');
    const footerEl = document.querySelector('footer');
    const bodyEndEl = document.querySelector('#body-end-scripts');

    if (headerEl) headerEl.innerHTML = headerHTML;
    if (footerEl) footerEl.innerHTML = footerHTML;
    if (bodyEndEl) bodyEndEl.innerHTML = modalHTML;

    const footerYear = document.querySelector('#footer-year');
    if (footerYear) footerYear.textContent = new Date().getFullYear();

    // All components are loaded, now run the scripts
    initializePageScripts();

    function initializePageScripts() {
        const carousel = document.querySelector('.home-carousel');
        if (carousel) {
            const slides = Array.from(carousel.querySelectorAll('.home-slide'));
            const counter = carousel.querySelector('.carousel-current');
            const status = carousel.querySelector('.carousel-status');
            let current = 0;
            let lastSwipe = 0;
            const framedImages = Array.from(carousel.querySelectorAll('img[data-head-top]'));
            function frameImages() {
                framedImages.forEach(img => {
                    const box = img.parentElement.getBoundingClientRect();
                    if (!box.width || !box.height || !img.naturalWidth) return;
                    const headTop = Number(img.dataset.headTop);
                    const coverScale = Math.max(box.width / img.naturalWidth, box.height / img.naturalHeight);
                    let headroom = Math.max(64, Math.min(96, box.height * 0.075));
                    if (img.dataset.shiftUp) {
                        const position = parseFloat(getComputedStyle(img).objectPosition.split(' ')[1]) / 100;
                        const renderedHeight = img.naturalHeight * coverScale;
                        const originalHeadroom = headTop * renderedHeight + (box.height - renderedHeight) * position;
                        headroom = Math.max(64, originalHeadroom - box.height * Number(img.dataset.shiftUp));
                    }
                    // Keep the crown at a stable distance from the top while filling the frame.
                    const scale = Math.max(coverScale, (box.height - headroom) / (img.naturalHeight * (1 - headTop)));
                    img.style.width = `${img.naturalWidth * scale}px`;
                    img.style.height = `${img.naturalHeight * scale}px`;
                    img.style.top = `${headroom - headTop * img.naturalHeight * scale}px`;
                });
            }
            framedImages.forEach(img => img.addEventListener('load', frameImages));
            const frameObserver = new ResizeObserver(frameImages);
            framedImages.forEach(img => frameObserver.observe(img.parentElement));
            frameImages();
            function selectSlide(index) {
                const photoFocused = document.activeElement?.classList.contains('hero-photo');
                current = (index + slides.length) % slides.length;
                slides.forEach((slide, i) => { slide.hidden = i !== current; });
                frameImages();
                counter.textContent = String(current + 1).padStart(2, '0');
                status.textContent = `${slides[current].dataset.name}, slide ${current + 1} of ${slides.length}`;
                carousel.querySelector('.featured-name').textContent = slides[current].dataset.name;
                if (photoFocused) {
                    const photos = slides[current].querySelectorAll('.hero-photo');
                    const visiblePhoto = Array.from(photos).find(photo => photo.getClientRects().length);
                    visiblePhoto?.focus({ preventScroll: true });
                }
            }
            carousel.querySelectorAll('.hero-photo').forEach(photo => {
                photo.addEventListener('click', () => {
                    if (Date.now() - lastSwipe > 400) selectSlide(current + 1);
                });
            });
            carousel.querySelector('.carousel-prev').addEventListener('click', () => selectSlide(current - 1));
            carousel.querySelector('.carousel-next').addEventListener('click', () => selectSlide(current + 1));
            carousel.addEventListener('keydown', event => {
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault();
                    selectSlide(current + (event.key === 'ArrowRight' ? 1 : -1));
                }
            });
            let touchStart;
            carousel.addEventListener('touchstart', event => {
                const touch = event.changedTouches[0];
                touchStart = { x: touch.clientX, y: touch.clientY };
            }, { passive: true });
            carousel.addEventListener('touchend', event => {
                if (!touchStart) return;
                const touch = event.changedTouches[0];
                const dx = touch.clientX - touchStart.x;
                const dy = touch.clientY - touchStart.y;
                if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
                    lastSwipe = Date.now();
                    selectSlide(current + (dx < 0 ? 1 : -1));
                }
                touchStart = null;
            }, { passive: true });
        }
        // --- Hamburger Menu Logic ---
        const hamburger = document.querySelector('.hamburger');
        const nav = document.querySelector('nav');

        function trapFocus(event, controls) {
            if (event.key !== 'Tab' || controls.length === 0) return;
            const first = controls[0];
            const last = controls[controls.length - 1];
            const current = document.activeElement;
            if (event.shiftKey && (current === first || !controls.includes(current))) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && (current === last || !controls.includes(current))) {
                event.preventDefault();
                first.focus();
            }
        }

        if (hamburger && nav) {
            // Set aria-current on the correct nav link
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const activeLink = nav.querySelector(`a[href="${currentPage}"]`);
            if (activeLink) {
                activeLink.setAttribute('aria-current', 'page');
            }

            const mobileMenu = window.matchMedia(document.body.classList.contains('page-home') ? '(max-width: 0px)' : '(max-width: 1024px)');
            const pageContent = Array.from(document.querySelectorAll('main, footer, .skip-link'));
            function setMenu(open, restoreFocus = false) {
                const expanded = mobileMenu.matches && open;
                nav.classList.toggle('active', expanded);
                hamburger.classList.toggle('active', expanded);
                hamburger.setAttribute('aria-expanded', String(expanded));
                nav.inert = mobileMenu.matches && !expanded;
                pageContent.forEach(element => { element.inert = expanded; });
                if (expanded) nav.querySelector('a')?.focus();
                else if (restoreFocus) hamburger.focus();
            }
            setMenu(false);
            mobileMenu.addEventListener('change', () => setMenu(false));

            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                setMenu(!nav.classList.contains('active'), true);
            });

            document.addEventListener('click', (e) => {
                if (nav.classList.contains('active') && !hamburger.contains(e.target) && !nav.contains(e.target)) {
                    setMenu(false, true);
                }
            });

            nav.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            document.addEventListener('keydown', event => {
                if (!nav.classList.contains('active')) return;
                if (event.key === 'Escape') {
                    event.preventDefault();
                    setMenu(false, true);
                } else {
                    trapFocus(event, [hamburger, ...nav.querySelectorAll('a')]);
                }
            });
        }

        // --- Modal Image Gallery Logic ---
        const modal = document.getElementById("imageModal");
        if (!modal) return; // Don't run if there's no modal on the page

        const modalImg = document.getElementById("modalImage");
        const loadingIndicator = modal.querySelector(".loading-indicator");
        const closeModalBtn = modal.querySelector(".close-modal-btn");
        const prevBtn = modal.querySelector(".prev-btn");
        const nextBtn = modal.querySelector(".next-btn");
        const downloadLink = modal.querySelector(".modal-download-link");
        const fullsizeLink = modal.querySelector('.modal-fullsize-link');
        const contentWrapper = modal.querySelector('.modal-content-wrapper');
        const expandIconPath = fullsizeLink.querySelector('path').getAttribute('d');

        let imagesToPopup = []; // This will be populated by initializeModelLightbox
        let currentImageIndex = 0;
        let lastFocusedElement;
        let modalMode = 'gallery';
        let backgroundState = [];
        let previousOverflow;

        function setCompCardExpanded(expanded) {
            modal.classList.toggle('comp-card-expanded', expanded);
            fullsizeLink.setAttribute('aria-pressed', String(expanded));
            const label = expanded ? 'Fit comp card to screen' : 'Expand comp card';
            fullsizeLink.setAttribute('aria-label', label);
            fullsizeLink.title = label;
            fullsizeLink.querySelector('path').setAttribute('d', expanded
                ? 'M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5M3 3l5 5m13-5-5 5M3 21l5-5m13 5-5-5'
                : expandIconPath);
            contentWrapper.tabIndex = expanded ? 0 : -1;
            contentWrapper.scrollTop = 0;
            contentWrapper.scrollLeft = 0;
        }

        fullsizeLink.addEventListener('click', () => {
            if (modalMode === 'comp-card') {
                setCompCardExpanded(!modal.classList.contains('comp-card-expanded'));
            }
        });

        function openModal(trigger, label) {
            lastFocusedElement = trigger;
            backgroundState = Array.from(document.body.children)
                .filter(element => !element.contains(modal))
                .map(element => ({ element, inert: element.inert }));
            backgroundState.forEach(({ element }) => { element.inert = true; });
            previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            modal.setAttribute('aria-label', label);
            modal.style.display = 'flex';
            closeModalBtn.focus();
        }

        function showImage(index) {
            if (index >= imagesToPopup.length) index = 0; // Loop to start
            if (index < 0) index = imagesToPopup.length - 1; // Loop to end
            
            const img = imagesToPopup[index];
            setCompCardExpanded(false);
            modalMode = 'gallery';
            modal.classList.remove('comp-card-modal');
            downloadLink.style.display = 'none';
            fullsizeLink.style.display = 'none';
            prevBtn.style.display = '';
            nextBtn.style.display = '';
            // Use getAttribute to get the relative path as written in the HTML.
            const originalSrc = img.getAttribute('src');
            modalImg.alt = img.alt;

            // Show spinner and hide image while it loads
            loadingIndicator.style.display = 'flex';
            loadingIndicator.innerHTML = '<div class="spinner"></div>';
            modalImg.style.display = 'none';

            modalImg.onload = function() {
              loadingIndicator.style.display = 'none';
                modalImg.style.display = 'block';
            };

            modalImg.onerror = function() {
                loadingIndicator.innerHTML = '<span>Could not load image.</span>';
                modalImg.style.display = 'none';
            };

            const basePath = img.getAttribute('data-base-src');
            if (basePath) {
                modalImg.src = `${basePath}-1200.webp`;
            } else {
                // Fallback: derive high-res path from src if data-base-src is missing
                const extension = originalSrc.split('.').pop();
                const fallbackSrc = originalSrc.replace(/-\d+\.(jpg|jpeg|png|webp)$/i, `-1200.${extension}`);
                modalImg.src = fallbackSrc;
            }

            currentImageIndex = index;
        }

        function showCompCard(link) {
            const compCardSrc = link.getAttribute('href');
            const modelName = link.dataset.modelName || 'Model';

            lastFocusedElement = link;
            modalMode = 'comp-card';
            setCompCardExpanded(false);
            modal.classList.add('comp-card-modal');
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            downloadLink.style.display = 'inline-flex';
            downloadLink.href = compCardSrc;
            fullsizeLink.style.display = 'inline-flex';
            downloadLink.setAttribute('download', `${modelName}_CompCard.png`);
            downloadLink.setAttribute('aria-label', `Download ${modelName} comp card as PNG`);
            modalImg.alt = `${modelName} comp card`;

            loadingIndicator.style.display = 'flex';
            loadingIndicator.innerHTML = '<div class="spinner"></div>';
            modalImg.style.display = 'none';
            modalImg.onload = function() {
                loadingIndicator.style.display = 'none';
                modal.style.setProperty('--comp-card-width', `${modalImg.naturalWidth}px`);
                modalImg.style.display = 'block';
            };
            modalImg.onerror = function() {
                loadingIndicator.innerHTML = '<span>Could not load comp card.</span>';
                modalImg.style.display = 'none';
            };
            modalImg.src = compCardSrc;
            openModal(link, `${modelName} comp card`);
        }

        function closeModal() {
            setCompCardExpanded(false);
            modal.style.display = "none";
            backgroundState.forEach(({ element, inert }) => { element.inert = inert; });
            document.body.style.overflow = previousOverflow;
            if (lastFocusedElement) {
                lastFocusedElement.focus(); // Return focus
            }
        }

        closeModalBtn.addEventListener('click', closeModal);
        
        modal.addEventListener('click', function(event) {
            if (event.target === modal) closeModal();
        });

        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showImage(currentImageIndex - 1);
        });

        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showImage(currentImageIndex + 1);
        });

        // Keyboard navigation for modal
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            }
            if (modalMode === 'gallery' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                showImage(currentImageIndex + (e.key === 'ArrowLeft' ? -1 : 1));
            }
            const controls = [closeModalBtn, prevBtn, nextBtn, fullsizeLink, downloadLink]
                .filter(element => element.style.display !== 'none');
            if (modal.classList.contains('comp-card-expanded')) controls.push(contentWrapper);
            trapFocus(e, controls);
        });

        // --- Model Feed Lightbox Logic ---
        initializeModelLightbox();

        document.querySelectorAll('.comp-card-link').forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                showCompCard(link);
            });
        });

        // --- Visibility Logic for Empty Sections ---
        handleEmptySections();

        initializeProfileBiography();

        function initializeModelLightbox() {
            const images = Array.from(document.querySelectorAll('.model-feed img'));
            if (images.length === 0) return;

            imagesToPopup = images; // Update global variable for modal logic
    
            images.forEach((img, index) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'gallery-image-btn';
                button.setAttribute('aria-label', `Enlarge ${img.alt}`);
                button.setAttribute('aria-haspopup', 'dialog');
                img.before(button);
                button.append(img);
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    showImage(index);
                    openModal(button, 'Image gallery');
                });
            });
        }

        function handleEmptySections() {
            const digitalsHeader = document.getElementById('digitals');
            const jumpLink = document.querySelector('.jump-link');
            
            if (!digitalsHeader) { // If there's no #digitals header, hide the jump link and exit
                if (jumpLink) jumpLink.style.display = 'none';
                return;
            }

            // Find the parent .digitals-section
            const digitalsSection = digitalsHeader.closest('.digitals-section');
            if (!digitalsSection) { // Fallback if structure is not as expected
                if (jumpLink) jumpLink.style.display = 'none';
                digitalsHeader.style.display = 'none';
                return;
            }

            // Check for images or pictures within the .model-feed inside this .digitals-section
            const digitalFeed = digitalsSection.querySelector('.model-feed');
            const hasImages = digitalFeed && digitalFeed.querySelector('img, picture');

            if (!hasImages) {
                if (jumpLink) jumpLink.style.display = 'none';
                digitalsHeader.style.display = 'none';
                digitalsSection.style.display = 'none'; // Hide the entire section if no images
            }
        }

        function initializeProfileBiography() {
            const bio = document.querySelector('.model-bio');
            if (!bio) return;
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            const mobile = window.matchMedia('(max-width: 899px)');
            details.className = 'model-bio-disclosure';
            summary.textContent = `About ${document.querySelector('.model-name').textContent.trim()}`;
            details.append(summary);
            while (bio.firstChild) details.append(bio.firstChild);
            bio.append(details);
            let mobileExpanded = false;
            details.addEventListener('toggle', () => {
                if (mobile.matches) mobileExpanded = details.open;
            });
            function updateBiography() {
                details.open = mobile.matches ? mobileExpanded : true;
            }
            mobile.addEventListener('change', updateBiography);
            updateBiography();
        }
    }

});
