// Shared footer for every public page and design preview.
const siteFooter = document.querySelector('footer');
if (siteFooter) {
    siteFooter.classList.add('site-footer');
    siteFooter.innerHTML = `
        <div class="container footer-inner">
            <p>&copy; <span id="footer-year">${new Date().getFullYear()}</span> Charizma Management</p>
            <p class="footer-credit">Crafted by The Folio Lab</p>
        </div>`;
}
