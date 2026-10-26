import fs from 'fs/promises';
import CleanCSS from 'clean-css';
import * as terser from 'terser';

async function minifyCSS() {
    const source = await fs.readFile('style.css', 'utf8');
    const result = new CleanCSS({ level: 2 }).minify(source);

    if (result.errors.length > 0) {
        throw new Error(`CSS minification failed: ${result.errors.join('; ')}`);
    }

    await fs.writeFile('style.min.css', result.styles, 'utf8');
    console.log('✓ Updated style.min.css');
}

async function minifyJavaScript() {
    const source = await fs.readFile('js/main.js', 'utf8');
    const result = await terser.minify(source, {
        compress: true,
        mangle: true,
    });

    if (!result.code) {
        throw new Error('JavaScript minification produced no output.');
    }

    await fs.writeFile('js/main.min.js', result.code, 'utf8');
    console.log('✓ Updated js/main.min.js');
}

async function build() {
    console.log('Building Charizma site assets…');
    await Promise.all([minifyCSS(), minifyJavaScript()]);
    console.log('✓ Build complete');
}

build().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
