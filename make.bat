@echo off
.\node_modules\.bin\browserify.cmd src/guppy.js -o build/guppy.min.js --standalone Guppy -d
.\node_modules\.bin\browserify.cmd src/guppy_render.js -o build/guppy_render.min.js --standalone guppy_render -d
.\node_modules\.bin\browserify.cmd src/guppy_doc.js -o build/guppy_doc.min.js --standalone GuppyDoc -d
.\node_modules\.bin\browserify.cmd src/guppy_backend.js -o build/guppy_backend.min.js --standalone GuppyBackend -d
