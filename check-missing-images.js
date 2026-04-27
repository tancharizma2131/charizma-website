import { glob } from 'glob';
import fs from 'fs/promises';
import path from 'path';
import { JSDOM } from 'jsdom';

async function checkMissing() {
    console.log('🔍 Starting comprehensive image check...');
    const htmlFiles = await glob('./*.html', { 
        ignore: ['index.html', 'about.html', 'be-charizmatic.html'],
        posix: true 
    });
    
    let totalLinksChecked = 0;
    let totalMissing = 0;

    for (const file of htmlFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const dom = new JSDOM(content);
        const { document } = dom.window;
        
        const missingInFile = new Set();

        // 1. Check <img> src attributes (fallback images)
        const imgs = document.querySelectorAll('img');
        for (const img of imgs) {
            const src = img.getAttribute('src');
            if (src) await verifyPath(src);
        }

        // 2. Check <source> srcset and <img> srcset attributes (WebP and responsive variants)
        const elementsWithSrcset = document.querySelectorAll('source[srcset], img[srcset]');
        for (const el of elementsWithSrcset) {
            const srcset = el.getAttribute('srcset');
            if (srcset) {
                // srcset can contain multiple URLs: "image-400.webp 400w, image-800.webp 800w"
                const urls = srcset.split(',').map(part => part.trim().split(' ')[0]);
                for (const url of urls) {
                    if (url) await verifyPath(url);
                }
            }
        }

        async function verifyPath(url) {
            totalLinksChecked++;
            const filePath = decodeURI(url).split('?')[0]; // Remove encoding and ignore query params
            try {
                await fs.access(filePath);
            } catch {
                missingInFile.add(filePath);
                totalMissing++;
            }
        }

        if (missingInFile.size > 0) {
            console.log(`❌ ${path.basename(file).padEnd(15)} | ${missingInFile.size} broken references:`);
            missingInFile.forEach(m => console.log(`   - ${m}`));
        } else if (imgs.length > 0 || elementsWithSrcset.length > 0) {
            console.log(`✅ ${path.basename(file).padEnd(15)} | Verified all image references.`);
        }
    }

    console.log('\n--- Summary ---');
    if (totalMissing === 0) {
        console.log(`🎉 Success! All ${totalLinksChecked} image references exist on disk.`);
    } else {
        console.log(`⚠️ Found ${totalMissing} broken links. Ensure your original source images exist in the "image/models/" directory, then run "node build.js".`);
    }
}

checkMissing().catch(console.error);