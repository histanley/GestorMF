const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Iniciando testes de Homologação da Tabela Oficial de Serviço (Impressão/Parede em Formato Timbrado Excel)...');

// 1. Verificar arquivo do modal
const modalPath = path.resolve(__dirname, '../src/components/ServiceBoardOfficialPrintModal.jsx');
assert(fs.existsSync(modalPath), 'Arquivo ServiceBoardOfficialPrintModal.jsx deve existir');
const modalSource = fs.readFileSync(modalPath, 'utf8');

// 2. Verificar Timbrado da Empresa
assert(modalSource.includes('21.973.641/0001-00'), 'Deve conter CNPJ oficial da MegaFilmes');
assert(modalSource.includes('TABELA OFICIAL DE SERVIÇO') && modalSource.includes('ESCALA OPERACIONAL DE CAMPO'), 'Deve conter título timbrado oficial');
assert(modalSource.includes('HOMOLOGAÇÃO') && modalSource.includes('RESPONSÁVEL SISTÊMICO'), 'Deve conter seção de homologação sistêmica');

// 3. Verificar Tabela Estilo Excel
assert(modalSource.includes('posm-excel-table'), 'Deve utilizar tabela com classe excel table');
assert(modalSource.includes('excel-mode'), 'Deve possuir container modo excel');
assert(modalSource.includes('HORÁRIO'), 'Cabeçalho da tabela deve conter Horário');
assert(modalSource.includes('CÓDIGO') && modalSource.includes('PAUTA DA MISSÃO'), 'Cabeçalho da tabela deve conter Código & Pauta');
assert(modalSource.includes('LOCAL') && modalSource.includes('PERCURSO'), 'Cabeçalho da tabela deve conter Local & Percurso');
assert(modalSource.includes('EQUIPE ESCALADA'), 'Cabeçalho da tabela deve conter Equipe Escalada');
assert(modalSource.includes('VIATURA') && modalSource.includes('MOTORISTA'), 'Cabeçalho da tabela deve conter Viatura & Motorista');
assert(modalSource.includes('PÓS-PRODUÇÃO'), 'Cabeçalho da tabela deve conter Pós-Produção');
assert(modalSource.includes('STATUS'), 'Cabeçalho da tabela deve conter Status');

// 4. Verificar Assinatura Digital e QR Code
assert(modalSource.includes('HOMOLOGAÇÃO DIGITAL DA DIRETORIA'), 'Deve conter badge de homologação digital');
assert(modalSource.includes('scheduleHash'), 'Deve gerar hash de autenticidade da escala');
assert(modalSource.includes('qrcode') || modalSource.includes('QRCode'), 'Deve utilizar gerador de QR Code');
assert(modalSource.includes('Lei Federal nº 14.063/2020'), 'Deve referenciar legislação de conformidade eletrônica');

// 5. Verificar Permissões (Apenas Gestor e Administrador)
assert(modalSource.includes('canPrintOfficialSchedule'), 'Modal deve conter verificação de permissão');
assert(modalSource.includes('posm-restricted-card'), 'Deve exibir card de restrição caso usuário não seja autorizado');

// 6. Verificar Integração no ServiceBoard.jsx
const boardPath = path.resolve(__dirname, '../src/components/ServiceBoard.jsx');
assert(fs.existsSync(boardPath), 'Arquivo ServiceBoard.jsx deve existir');
const boardSource = fs.readFileSync(boardPath, 'utf8');

assert(boardSource.includes('ServiceBoardOfficialPrintModal'), 'ServiceBoard.jsx deve importar ServiceBoardOfficialPrintModal');
assert(boardSource.includes('isPrintModalOpen'), 'ServiceBoard.jsx deve conter estado isPrintModalOpen');
assert(boardSource.includes('canPrintOfficialSchedule'), 'ServiceBoard.jsx deve conter verificação canPrintOfficialSchedule');
assert(boardSource.includes('<ServiceBoardOfficialPrintModal'), 'ServiceBoard.jsx deve renderizar o ServiceBoardOfficialPrintModal');

// 7. Verificar CSS
const cssPath = path.resolve(__dirname, '../src/App.css');
const cssSource = fs.readFileSync(cssPath, 'utf8');
assert(cssSource.includes('posm-excel-table'), 'App.css deve conter estilos de posm-excel-table');
assert(cssSource.includes('landscape-sheet'), 'App.css deve conter estilos de landscape-sheet');
assert(cssSource.includes('printing-official-schedule'), 'App.css deve conter regras de mídia de impressão em A4 paisagem');

console.log('✅ Todos os testes da Tabela Oficial de Serviço (Impressão/Parede) passaram com 100% de sucesso!');
