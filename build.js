import sharp from 'sharp';
import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';
import { JSDOM } from 'jsdom';
import * as terser from 'terser';
import CleanCSS from 'clean-css';

// --- Configuration ---
const SIZES = [400, 800, 1200, 1600];
const SOURCE_FOLDER = 'image/models/**/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}';
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 75;
const HTML_FILES_PATTERN = './*.html';
const EXCLUDE_FILES = ['index.html', 'about.html', 'be-charizmatic.html'];

/**
 * Deletes all previously generated build artifacts.
 */
async function clean() {
    console.log('\n--- Step 1: Cleaning up old build artifacts ---');
    // Use a robust pattern to catch all resized images ([filename]-[number].[ext])
    const generatedFilePatterns = [
        'image/models/**/*-[0-9]*.{jpg,jpeg,webp,png,JPG,JPEG,WEBP,PNG}',
        './style.min.css',
        './style.min.css.map',
        './js/main.min.js',
        './js/main.min.js.map',
    ];
    const filesToDelete = await glob(generatedFilePatterns);

    if (filesToDelete.length === 0) {
        console.log('No generated images found to clean.');
        return;
    }

    console.log(`Found ${filesToDelete.length} generated files to delete.`);
    let deletedCount = 0;
    for (const file of filesToDelete) {
        try {
            await fs.unlink(file);
            deletedCount++;
        } catch (e) {
            console.error(`  - Error deleting ${file}: ${e.message}`);
        }
    }

    // Clean up empty directories in image/models that might have been created during sanitization
    const allDirs = await glob('image/models/**/', { posix: true });
    let dirCount = 0;
    for (const dir of allDirs.reverse()) { // Reverse to handle nested empty folders first
        try {
            const files = await fs.readdir(dir);
            if (files.length === 0) {
                await fs.rmdir(dir);
                dirCount++;
            }
        } catch (e) {
            // Directory not empty or already gone
        }
    }

    console.log(`Cleanup complete! Deleted ${deletedCount} files and ${dirCount} empty directories.`);
}

/**
 * Processes all source images to create resized JPEG and WebP versions.
 */
async function processImages() {
    console.log('\n--- Step 2: Processing source images ---');
    const imagePaths = await glob(SOURCE_FOLDER);

    if (imagePaths.length === 0) {
        console.log('No images found to process.');
        return;
    }

    console.log(`Found ${imagePaths.length} source images to process.`);
    let processedCount = 0;
    for (const imagePath of imagePaths) {
        try {
            const generatedImageRegex = new RegExp(`-(${SIZES.join('|')})\\.(jpg|jpeg|png|webp)$`, 'i');
            if (generatedImageRegex.test(imagePath)) continue;

            // Create a base path (dir + filename, no extension) and sanitize it completely.
            // This handles spaces in both directory and file names.
            const fileInfo = path.parse(imagePath);
            const basePathWithSpaces = path.join(fileInfo.dir, fileInfo.name);
            const sanitizedBasePath = basePathWithSpaces.replace(/\s+/g, '-');

            const image = sharp(imagePath, { failOn: 'none' });
            
            console.log(`Processing (${processedCount + 1}/${imagePaths.length}): ${path.basename(imagePath)}`);

            // Ensure the destination directory exists before writing files.
            const outputDir = path.dirname(sanitizedBasePath);
            await fs.mkdir(outputDir, { recursive: true });

            for (const size of SIZES) {
                const jpegOutputPath = `${sanitizedBasePath}-${size}.jpg`;
                const webpOutputPath = `${sanitizedBasePath}-${size}.webp`;

                await image.clone().resize({ width: size }).jpeg({ quality: JPEG_QUALITY }).toFile(jpegOutputPath);
                await image.clone().resize({ width: size }).webp({ quality: WEBP_QUALITY, effort: 6 }).toFile(webpOutputPath);
            }
            processedCount++;
        } catch (e) {
            console.error(`\n--- ERROR processing ${imagePath} ---`);
            console.error(`This can happen with corrupted files. The script will skip this image.`);
            console.error(`Error message: ${e.message}`);
            console.error('--------------------------------------');
            continue;
        }
    }
    console.log(`Image processing complete! Processed ${processedCount} source files.`);
}

/**
 * Determines the correct `sizes` attribute for an image.
 */
function getSizesAttribute(img) {
    if (img.closest('.model-card')) {
        // Sizes for the main model grid pages (women.html, men.html)
        return '(max-width: 768px) 90vw, (max-width: 1024px) 45vw, 30vw';
    }

    if (img.closest('.model-feed')) {
        return '(max-width: 600px) 48vw, (max-width: 1024px) 31vw, 23vw';
    }

    const galleryGrid = img.closest('.gallery-grid');
    if (galleryGrid) {
        if (galleryGrid.classList.contains('single-column')) {
            return '(max-width: 550px) 90vw, 500px';
        }

        const imageGroup = img.closest('.image-group');
        if (imageGroup && imageGroup.classList.contains('single-image-in-group')) {
            return '(max-width: 768px) 95vw, 590px';
        }
        return '(max-width: 768px) 48vw, 295px';
    }

    // Fallback for any other case
    return '(max-width: 768px) 90vw, 1200px';
}

/**
 * Minifies the main CSS file.
 */
async function minifyCSS() {
    console.log('\n--- Step 4: Minifying CSS ---');
    try {
        const source = await fs.readFile('./style.css', 'utf-8');
        const minified = new CleanCSS().minify(source);
        await fs.writeFile('./style.min.css', minified.styles, 'utf-8');
        const originalSize = Buffer.byteLength(source, 'utf-8');
        const minifiedSize = Buffer.byteLength(minified.styles, 'utf-8');
        const saved = originalSize - minifiedSize;
        const percentSaved = ((saved / originalSize) * 100).toFixed(2);
        console.log(`  ✓ Minified style.css -> style.min.css. Saved ${saved} bytes (${percentSaved}%).`);
    } catch (error) {
        console.error('  - Could not minify CSS.', error);
    }
}

/**
 * Minifies the main JavaScript file.
 */
async function minifyJS() {
    console.log('\n--- Step 5: Minifying JavaScript ---');
    try {
        const source = await fs.readFile('./js/main.js', 'utf-8');
        const result = await terser.minify(source);
        if (result.error) throw result.error;

        await fs.writeFile('./js/main.min.js', result.code, 'utf-8');
        const originalSize = Buffer.byteLength(source, 'utf-8');
        const minifiedSize = Buffer.byteLength(result.code, 'utf-8');
        const saved = originalSize - minifiedSize;
        const percentSaved = ((saved / originalSize) * 100).toFixed(2);
        console.log(`  ✓ Minified js/main.js -> js/main.min.js. Saved ${saved} bytes (${percentSaved}%).`);
    } catch (error) {
        console.error('  - Could not minify JavaScript.', error);
    }
}

/**
 * Creates a <source> element with the correct srcset.
 */
function createSourceElement(document, basePath, format) {
    const source = document.createElement('source');
    const type = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
    const fileExt = format === 'jpeg' ? 'jpg' : format;
    
    source.setAttribute('type', type);

    const srcset = SIZES
        .map(size => `${encodeURI(`${basePath}-${size}.${fileExt}`)} ${size}w`)
        .join(', ');
    
    source.setAttribute('srcset', srcset);
    return source;
}

/**
 * Updates all model HTML pages with optimized <picture> elements.
 */
async function updateHtmlFiles() {
    console.log('\n--- Step 6: Updating HTML files with optimized assets ---');
    const htmlFiles = await glob(HTML_FILES_PATTERN);

    if (htmlFiles.length === 0) {
        console.log('No HTML files found to update.');
        return;
    }

    console.log(`Found ${htmlFiles.length} HTML files to process.`);
    let totalImagesUpdated = 0;
    let totalFilesModified = 0;

    for (const file of htmlFiles) {
        const htmlContent = await fs.readFile(file, 'utf-8');
        const dom = new JSDOM(htmlContent);
        const { document } = dom.window;
        let fileWasModified = false;

        // Update asset links to minified versions
        const cssLink = document.querySelector('link[href="style.css"]');
        if (cssLink) {
            cssLink.setAttribute('href', 'style.min.css');
            fileWasModified = true;
        }
        const jsScript = document.querySelector('script[src="js/main.js"]');
        if (jsScript) {
            jsScript.setAttribute('src', 'js/main.min.js');
            fileWasModified = true;
        }

        // Add Font Preloading for Performance
        const head = document.querySelector('head');
        if (head) {
            const fontsToPreload = ['/fonts/Roboto-Thin.woff2', '/fonts/Roboto-Regular.woff2'];
            fontsToPreload.forEach(fontPath => {
                if (!head.querySelector(`link[href="${fontPath}"][rel="preload"]`)) {
                    const link = document.createElement('link');
                    link.rel = 'preload';
                    link.href = fontPath;
                    link.as = 'font';
                    link.type = 'font/woff2';
                    link.crossOrigin = 'anonymous';
                    head.prepend(link);
                }
            });
        }

        // Update image tags only on model pages
        const isModelPage = !EXCLUDE_FILES.includes(path.basename(file));
        let imagesUpdatedInFile = 0;
        if (isModelPage) {
        const imagesToUpdate = Array.from(document.querySelectorAll('.model-gallery img, .model-grid img, .model-feed img'));

        for (const [index, img] of imagesToUpdate.entries()) {
            // If the image is already in a picture tag, unwrap it so we can re-process it cleanly.
            // This makes the script idempotent and corrects previous bad runs.
            const parentPicture = img.closest('picture');
            if (parentPicture) {
                parentPicture.replaceWith(img);
            }

            const originalSrc = img.getAttribute('src');
            if (!originalSrc) continue;

            try {
                const decodedSrc = decodeURI(originalSrc);
                const picture = document.createElement('picture');
                const sizesAttr = getSizesAttribute(img);
                
                // Get the base path of the image, without the file extension.
                const lastDotIndex = decodedSrc.lastIndexOf('.');
                let basePath = (lastDotIndex > 0) ? decodedSrc.substring(0, lastDotIndex) : decodedSrc;

                // Remove any pre-existing size suffix (e.g., -400, -800) to make the script idempotent.
                // The while loop makes it robust against multiple runs, stripping all appended sizes.
                const sizeSuffixRegex = new RegExp(`-(${SIZES.join('|')})$`);
                while(sizeSuffixRegex.test(basePath)) {
                    basePath = basePath.replace(sizeSuffixRegex, '');
                }
                
                // Look for the source file to verify it exists
                // We allow for spaces in the filesystem that might be represented as hyphens in the HTML
                const fuzzyBasePath = basePath.replace(/-/g, '{-, }');
                const sourcePattern = `${fuzzyBasePath}.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}`;
                
                let sourceFiles = await glob(sourcePattern);
                
                if (sourceFiles.length === 0) {
                    console.warn(`  ⚠️  Warning: Source image not found for "${basePath}" in ${file}.`);
                    console.warn(`      The script cannot regenerate optimized versions without the original file.`);
                    continue;
                }

                // Detect orientation automatically
                const metadata = await sharp(sourceFiles[0]).metadata();
                const isLandscape = metadata.width > metadata.height;
                if (isLandscape) {
                    picture.classList.add('landscape');
                }

                // Sanitize the clean base path by replacing spaces with hyphens.
                // We also decodeURI to handle any encoded spaces in the HTML src.
                const sanitizedBasePath = decodeURI(basePath).replace(/\s+/g, '-');

                const webpSource = createSourceElement(document, sanitizedBasePath, 'webp');
                const jpegSource = createSourceElement(document, sanitizedBasePath, 'jpeg');

                // Set the fallback src to a real, generated, sanitized image.
                const fallbackSrc = `${sanitizedBasePath}-800.jpg`;
                img.setAttribute('src', encodeURI(fallbackSrc));
                img.setAttribute('sizes', sizesAttr); // Set sizes on <img> for modern browsers.
                img.setAttribute('data-base-src', encodeURI(sanitizedBasePath));

                // Performance Optimization: The first image is likely the LCP element.
                // We prioritize it and prevent lazy-loading.
                if (index === 0) {
                    img.setAttribute('fetchpriority', 'high');
                    img.removeAttribute('loading');
                } else {
                    if (img.closest('.headshots')) {
                        img.removeAttribute('loading');
                    } else if (!img.hasAttribute('loading')) {
                        img.setAttribute('loading', 'lazy');
                    }
                }

                img.parentNode.replaceChild(picture, img);
                picture.appendChild(webpSource);
                picture.appendChild(jpegSource);
                picture.appendChild(img);
                imagesUpdatedInFile++;
                fileWasModified = true;
            } catch (e) {
                console.error(`  - Could not update HTML for image "${originalSrc}" in ${file}. Is the source file missing? Skipping. Error: ${e.message}`);
            }
        }
        }

        if (fileWasModified) {
            await fs.writeFile(file, dom.serialize(), 'utf-8');
            totalFilesModified++;
            if (imagesUpdatedInFile > 0) {
                console.log(`  ✓ Updated ${path.basename(file)} with ${imagesUpdatedInFile} images and minified assets.`);
                totalImagesUpdated += imagesUpdatedInFile;
            } else {
                console.log(`  ✓ Updated asset links in ${path.basename(file)}.`);
            }
        }
    }
    console.log(`HTML update complete! Modified ${totalFilesModified} files and updated ${totalImagesUpdated} image tags.`);
}

/**
 * Runs the entire build process in sequence.
 */
async function runBuild() {
    const skipImages = process.argv.includes('--skip-images');
    const cleanOnly = process.argv.includes('--clean-only');

    if (cleanOnly) {
        await clean();
        console.log('✨ Cleaned up generated artifacts. Storage should be recovered.');
        return;
    }

    if (skipImages) {
        console.log('🚀 Starting light build (skipping images)...');
    } else {
        console.log('🚀 Starting full build process...');
        await clean();
        await processImages();
    }
    await minifyCSS();
    await minifyJS();
    await updateHtmlFiles();
    console.log('\n✅ Build process completed successfully!\n');
}

runBuild().catch(error => {
    console.error('\n❌ Build process failed:', error);
    process.exit(1);
});
