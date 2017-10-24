browserify src/mathylem.js -o build/mathylem.min.js --standalone MathYlem $1
browserify src/mathylem_render.js -o build/mathylem_render.min.js --standalone mathylem_render $1
browserify src/mathylem_doc.js -o build/mathylem_doc.min.js --standalone MathYlemDoc $1
browserify src/mathylem_backend.js -o build/mathylem_backend.min.js --standalone MathYlemBackend $1
cp lib/katex/katex-modified.min.css build/mathylem.katex.min.css
cp -r lib/katex/fonts build
