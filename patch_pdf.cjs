const fs = require('fs');
let file = fs.readFileSync('components/PontoTab.tsx', 'utf8');

// 1. Remove detailRows declarations and usage
file = file.replace(/const detailRows: any\[\] = \[\];\n/, '');
file = file.replace(/let finalDetailRows = detailRows;[\s\S]*?finalDetailRows = finalDetailRows\.slice\(-2\);\n    }\n/, '');

// 2. Remove pushing to detailRows
file = file.replace(/detailRows\.push\(rowData\);\n/g, '');

// 3. Remove rowData definition
file = file.replace(/const rowData = \[\s*`\${format\(dayDate, 'dd\/MM'\)} \(\${fullDayOfWeekName}\)`,\s*`\${dayEntry\.morningArrival \|\| '-'} às \${dayEntry\.morningExit \|\| '-'}\\n\${dayEntry\.afternoonArrival \|\| '-'} às \${dayEntry\.afternoonExit \|\| '-'}`,\s*`\[\+\] Crédito permanência: \${details\.creditoPermanencia} min\\n\[-\] Atrasos: \${details\.atrasos} min\\n\[-\] Buscar filho: \${details\.buscarFilho} min\\n\(=\) Saldo final: \${details\.saldoMinutos < 0 \? \`-\${Math\.abs\(details\.saldoMinutos\)} min\` : \`\+\${details\.saldoMinutos} min\`}`,\s*`Tempo registrado: \${formatMinutesToHuman\(details\.tempoRegistrado\)}\\nAbatimentos \(Filho\): -\${details\.buscarFilho} min\\nTotal Considerado: \${formatMinutesToHuman\(details\.tempoConsiderado\)}`,\s*detailSaldoText\s*\];\n/g, '');

// 4. Remove detailSaldoText logic
file = file.replace(/let detailSaldoText = `Saldo Banco: \${details\.saldoMinutos > 0 \? '\+' : ''}\${details\.saldoMinutos} min\\n`;\n\s*if \(details\.saldoMinutos < 0\) {\n\s*detailSaldoText \+= `Saldo devedor: -\${Math\.abs\(details\.saldoMinutos\)} min`;\n\s*} else {\n\s*detailSaldoText \+= `\(Jornada completa\)`;\n\s*}\n/g, '');

// 5. Remove the detailed section printing
file = file.replace(/\/\/ SEÇÃO DE EXPLICAÇÃO DETALHADA DOS DIAS TRABALHADOS[\s\S]*?currentY = 15;\n      }\n/m, '');

// 6. Change function signature
file = file.replace(/const handleDownloadPdf = \(detailed: boolean = true\) => {/, 'const handleDownloadPdf = () => {');

// 7. Change the buttons in UI
const uiRegex = /<div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">[\s\S]*?<\/div>\n          <\/div>\n        <\/div>\n      <\/Card>/m;
const uiReplacement = `<div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
              <button
              onClick={() => handleDownloadPdf()}
              className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
            </div>
          </div>
        </div>
      </Card>`;
file = file.replace(uiRegex, uiReplacement);

fs.writeFileSync('components/PontoTab.tsx', file, 'utf8');
console.log('Patched PDF export');
