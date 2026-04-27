import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';

const TARGET_HTML = 'kami.html';
const IMAGE_DIR = 'image/models/women/kami/Portfolio';

async function restore() {
    console.log(`🔍 Scanning ${IMAGE_DIR} and subdirectories...`);
    
    // Find all source images recursively
    const allImages = await glob(`${IMAGE_DIR}/**/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}`);
    const sourceImages = allImages.filter(img => !/-\d+\.(jpg|jpeg|png|webp)$/i.test(img));
    
    console.log(`   Found ${sourceImages.length} source images.`);

    // Read HTML
    const html = await fs.readFile(TARGET_HTML, 'utf-8');
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    
    // Get existing images in the feed to avoid duplicates
    const existingImages = Array.from(doc.querySelectorAll('.model-feed img'))
        .map(img => {
            let src = img.getAttribute('data-base-src') || img.src;
            src = src.replace(/-\d+\.(jpg|jpeg|png|webp)$/i, '');
            return decodeURI(src);
        });
        
    const newImages = [];
    
    for (const imgPath of sourceImages) {
        const relativePath = imgPath.replace(/\\/g, '/');
        const basePath = relativePath.substring(0, relativePath.lastIndexOf('.'));
        
        // Check if this image path (regardless of extension) is already in the HTML
        const isPresent = existingImages.some(src => src.includes(basePath.replace(/\s+/g, '-')));
        
        if (!isPresent) {
            newImages.push(basePath);
        }
    }
    
    if (newImages.length === 0) {
        console.log('✅ No missing images found in folders. Everything matches the HTML!');
        return;
    }
    
    console.log(`✨ Restoring ${newImages.length} images to ${TARGET_HTML}...`);
    
    const feed = doc.querySelector('.model-feed');
    const digitalsHeader = doc.querySelector('.feed-section-title');
    
    const tempContainer = doc.createElement('div');
    newImages.forEach(basePath => {
        const sanitizedBasePath = basePath.replace(/\s+/g, '-');
        tempContainer.innerHTML += `
            <picture>
                <source type="image/webp" srcset="${sanitizedBasePath}-400.webp 400w, ${sanitizedBasePath}-800.webp 800w, ${sanitizedBasePath}-1200.webp 1200w, ${sanitizedBasePath}-1600.webp 1600w">
                <source type="image/jpeg" srcset="${sanitizedBasePath}-400.jpg 400w, ${sanitizedBasePath}-800.jpg 800w, ${sanitizedBasePath}-1200.jpg 1200w, ${sanitizedBasePath}-1600.jpg 1600w">
                <img src="${sanitizedBasePath}-800.jpg" alt="Kami portfolio" loading="lazy" sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw" data-base-src="${sanitizedBasePath}">
            </picture>
        `;
    });
    
    const newNodes = Array.from(tempContainer.children);
    if (digitalsHeader) {
        newNodes.forEach(node => feed.insertBefore(node, digitalsHeader));
    } else {
        newNodes.forEach(node => feed.appendChild(node));
    }
    
    await fs.writeFile(TARGET_HTML, dom.serialize());
    console.log('🎉 Done! Images restored to kami.html. Now run "node build.js" once.');
}

restore().catch(console.error);