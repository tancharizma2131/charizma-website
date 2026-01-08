import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';

const TARGET_HTML = 'thallys.html';
const IMAGE_DIR = 'image/models/men/thallys/Portfolio';

async function restore() {
    console.log(`🔍 Scanning ${IMAGE_DIR}...`);
    
    // Find all images (jpg, png, webp)
    const allImages = await glob(`${IMAGE_DIR}/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}`);
    
    // Filter out the generated ones (containing -400, -800, etc.)
    const sourceImages = allImages.filter(img => !/-\d+\.(jpg|jpeg|png|webp)$/i.test(img));
    
    console.log(`   Found ${sourceImages.length} source images.`);

    // Read HTML
    const html = await fs.readFile(TARGET_HTML, 'utf-8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    // Get existing images in the feed to avoid duplicates
    const existingImages = Array.from(doc.querySelectorAll('.model-feed img'))
        .map(img => img.getAttribute('data-base-src') || img.src);
        
    const newImages = [];
    
    for (const imgPath of sourceImages) {
        const filename = path.basename(imgPath);
        const name = path.parse(filename).name;
        
        // Check if this image name is already in the HTML
        const isPresent = existingImages.some(src => src.includes(name));
        
        if (!isPresent) {
            // Construct the base path relative to the HTML file
            // e.g. image/models/men/thallys/Portfolio/IMG_1234
            const relativePath = imgPath.replace(/\\/g, '/'); // Fix windows slashes
            const basePath = relativePath.substring(0, relativePath.lastIndexOf('.'));
            
            newImages.push(basePath);
        }
    }
    
    if (newImages.length === 0) {
        console.log('✅ No missing images found. Everything looks good!');
        return;
    }
    
    console.log(`✨ Restoring ${newImages.length} images to ${TARGET_HTML}...`);
    
    const feed = doc.querySelector('.model-feed');
    const digitalsHeader = doc.querySelector('.feed-section-title');
    
    // Create HTML for new images
    const tempContainer = doc.createElement('div');
    newImages.forEach(basePath => {
        tempContainer.innerHTML += `
            <picture>
                <source type="image/webp" srcset="${basePath}-400.webp 400w, ${basePath}-800.webp 800w, ${basePath}-1200.webp 1200w, ${basePath}-1600.webp 1600w">
                <source type="image/jpeg" srcset="${basePath}-400.jpg 400w, ${basePath}-800.jpg 800w, ${basePath}-1200.jpg 1200w, ${basePath}-1600.jpg 1600w">
                <img src="${basePath}-800.jpg" alt="Thallys portfolio" loading="lazy" sizes="(max-width: 768px) 90vw, (max-width: 1024px) 60vw, 50vw" data-base-src="${basePath}">
            </picture>
        `;
    });
    
    // Insert before Digitals section
    const newNodes = Array.from(tempContainer.children);
    if (digitalsHeader) {
        newNodes.forEach(node => feed.insertBefore(node, digitalsHeader));
    } else {
        newNodes.forEach(node => feed.appendChild(node));
    }
    
    await fs.writeFile(TARGET_HTML, dom.serialize());
    console.log('🎉 Done! Images restored.');
}

restore().catch(console.error);