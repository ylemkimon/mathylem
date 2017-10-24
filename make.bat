@echo off
call .\node_modules\.bin\browserify.cmd src/mathylem.js -o build/mathylem.min.js --standalone MathYlem -d
call .\node_modules\.bin\browserify.cmd src/mathylem_render.js -o build/mathylem_render.min.js --standalone mathylem_render -d
call .\node_modules\.bin\browserify.cmd src/mathylem_doc.js -o build/mathylem_doc.min.js --standalone MathYlemDoc -d
call .\node_modules\.bin\browserify.cmd src/mathylem_backend.js -o build/mathylem_backend.min.js --standalone MathYlemBackend -d
pause
