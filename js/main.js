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
    <p>&copy; 2025 Charizma Management</p>
</div>
`;

const modalHTML = `
<div id="imageModal" class="modal">
  <span class="close-modal-btn">&times;</span>
  <span class="prev-btn modal-nav-btn">&#10094;</span>
  <span class="next-btn modal-nav-btn">&#10095;</span>
  <div class="modal-content-wrapper">
    <div class="loading-indicator">
        <div class="spinner"></div>
    </div>
    <img class="modal-content" id="modalImage" alt="Enlarged view" style="display: none;">
  </div>
</div>
`;

document.addEventListener('DOMContentLoaded', () => {
    const headerEl = document.querySelector('header');
    const footerEl = document.querySelector('footer');
    const bodyEndEl = document.querySelector('#body-end-scripts');

    if (headerEl) headerEl.innerHTML = headerHTML;
    if (footerEl) footerEl.innerHTML = footerHTML;
    if (bodyEndEl) bodyEndEl.innerHTML = modalHTML;

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

        let imagesToPopup = []; // This will be populated by initializeModelLightbox
        let currentImageIndex = 0;
        let lastFocusedElement;

        function showImage(index) {
            if (index >= imagesToPopup.length) index = 0; // Loop to start
            if (index < 0) index = imagesToPopup.length - 1; // Loop to end
            
            const img = imagesToPopup[index];
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

        // --- Visibility Logic for Empty Sections ---
        handleEmptySections();

        // --- Mobile Hover/Tap Logic for Roster ---
        initializeMobileHover();

        function initializeModelLightbox() {
            const modelFeed = document.querySelector('.model-feed');
            if (!modelFeed) return;
    
            // Select all images in the feed
            const images = Array.from(modelFeed.querySelectorAll('img'));
            imagesToPopup = images; // Update global variable for modal logic
    
            images.forEach((img, index) => {
                img.addEventListener('click', (e) => {
                    e.stopPropagation();
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