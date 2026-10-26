const headerHTML = `
<div class="header-socials">
    <a href="https://www.instagram.com/charizma.management/" target="_blank" rel="noopener noreferrer" aria-label="Charizma Management on Instagram" title="Instagram">
        <img src="image/instagram.png" alt="Instagram logo" class="social-icon" />
    </a>
</div>
<div class="container">
    <div class="header-flex">
        <a href="index.html" class="logo">Charizma Management</a>
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
    <p>&copy; <span id="footer-year"></span> Charizma Management <span class="footer-credit">&middot; Site by Folio Lab</span></p>
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
        // --- Hamburger Menu Logic ---
        const hamburger = document.querySelector('.hamburger');
        const nav = document.querySelector('nav');

        if (hamburger && nav) {
            // Set aria-current on the correct nav link
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            const activeLink = nav.querySelector(`a[href="${currentPage}"]`);
            if (activeLink) {
                activeLink.setAttribute('aria-current', 'page');
            }

            hamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isActive = nav.classList.toggle('active');
                hamburger.classList.toggle('active');
                hamburger.setAttribute('aria-expanded', isActive);
            });

            document.addEventListener('click', (e) => {
                if (nav.classList.contains('active') && !hamburger.contains(e.target) && !nav.contains(e.target)) {
                    nav.classList.remove('active');
                    hamburger.classList.remove('active');
                    hamburger.setAttribute('aria-expanded', 'false');
                }
            });

            nav.addEventListener('click', (e) => {
                e.stopPropagation();
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

        let imagesToPopup = []; // This will be populated by initializeModelLightbox
        let currentImageIndex = 0;
        let lastFocusedElement;

        function showImage(index) {
            if (index >= imagesToPopup.length) index = 0; // Loop to start
            if (index < 0) index = imagesToPopup.length - 1; // Loop to end
            
            const img = imagesToPopup[index];
            modal.classList.remove('comp-card-modal');
            downloadLink.style.display = 'none';
            prevBtn.style.display = '';
            nextBtn.style.display = '';
            // Use getAttribute to get the relative path as written in the HTML.
            const originalSrc = img.getAttribute('src');
            modalImg.alt = img.alt;

            // Show spinner and hide image while it loads
            loadingIndicator.style.display = 'flex';
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
            modal.focus();
        }

        function showCompCard(link) {
            const compCardSrc = link.getAttribute('href');
            const modelName = link.dataset.modelName || 'Model';

            lastFocusedElement = link;
            modal.classList.add('comp-card-modal');
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
            downloadLink.style.display = 'inline-flex';
            downloadLink.href = compCardSrc;
            downloadLink.setAttribute('download', `${modelName}_CompCard.png`);
            downloadLink.setAttribute('aria-label', `Download ${modelName} comp card as PNG`);
            modalImg.alt = `${modelName} comp card`;

            loadingIndicator.style.display = 'flex';
            modalImg.style.display = 'none';
            modalImg.onload = function() {
                loadingIndicator.style.display = 'none';
                modalImg.style.display = 'block';
            };
            modalImg.onerror = function() {
                loadingIndicator.innerHTML = '<span>Could not load comp card.</span>';
                modalImg.style.display = 'none';
            };
            modalImg.src = compCardSrc;
            modal.style.display = 'flex';
            modal.focus();
        }

        function closeModal() {
            modal.style.display = "none";
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
            if (e.key === 'Escape') closeModal();
            if (e.key === 'ArrowLeft') showImage(currentImageIndex - 1);
            if (e.key === 'ArrowRight') showImage(currentImageIndex + 1);
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

        // --- Mobile Hover/Tap Logic for Roster ---
        initializeMobileHover();

        function initializeModelLightbox() {
            const images = Array.from(document.querySelectorAll('.model-feed img'));
            if (images.length === 0) return;

            imagesToPopup = images; // Update global variable for modal logic
    
            images.forEach((img, index) => {
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
                    lastFocusedElement = img;
                    const modal = document.getElementById("imageModal");
                    modal.style.display = 'flex';
                    showImage(index);
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

        function initializeMobileHover() {
            const modelCards = document.querySelectorAll('.model-card');
            
            modelCards.forEach(card => {
                card.addEventListener('click', function(e) {
                    // Check if the user is on a touch device
                    if (window.matchMedia("(pointer: coarse)").matches) {
                        if (!this.classList.contains('touch-active')) {
                            // First tap: prevent navigation and show stats
                            e.preventDefault();
                            
                            // Remove active state from other cards for a clean UI
                            modelCards.forEach(c => c.classList.remove('touch-active'));
                            
                            this.classList.add('touch-active');
                        }
                        // If already active, the second tap follows the link naturally
                    }
                });
            });

            // Hide stats when tapping outside a card
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.model-card')) {
                    modelCards.forEach(c => c.classList.remove('touch-active'));
                }
            });
        }
    }

});
