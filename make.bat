@echo off
call .\node_modules\.bin\browserify.cmd js/mathylem.js -o build/mathylem.min.js --standalone MathYlem -d
call .\node_modules\.bin\browserify.cmd js/mathylem_render.js -o build/mathylem_render.min.js --standalone mathylem_render -d
call .\node_modules\.bin\browserify.cmd js/mathylem_doc.js -o build/mathylem_doc.min.js --standalone MathYlemDoc -d
call .\node_modules\.bin\browserify.cmd js/mathylem_backend.js -o build/mathylem_backend.min.js --standalone MathYlemBackend -d
copy /y css\mathylem.css build\mathylem.css
copy /y data\symbols.json build\symbols.json
copy /y lib\katex\katex-modified.min.css build\mathylem.katex.min.css
xcopy /e /y lib\katex\fonts build\fonts
pause
