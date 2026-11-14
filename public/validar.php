<?php
// ==============================================================================
// GestorMF - Página Pública de Validação e Autenticidade de Documentos
// Acessível publicamente por qualquer pessoa através do QR Code do documento
// ==============================================================================
require_once __DIR__ . '/api/config.php';

header('Content-Type: text/html; charset=utf-8');

$code = trim($_GET['code'] ?? '');
$db = getDB();

$rental = null;
$isValid = false;
$errorMessage = '';

if (!empty($code)) {
    try {
        $stmt = $db->prepare("SELECT * FROM rentals WHERE code = ? LIMIT 1");
        $stmt->execute([$code]);
        $rental = $stmt->fetch();
        if ($rental) {
            $isValid = true;
        } else {
            $errorMessage = 'O código informado não corresponde a nenhum documento registrado no acervo oficial.';
        }
    } catch (Exception $e) {
        $errorMessage = 'Erro ao consultar a base de dados de autenticidade.';
    }
} else {
    $errorMessage = 'Nenhum código de documento foi informado para validação.';
}

$items = [];
$maskedDoc = '';
$authorizer = 'Gestão MegaFilmes';
$authHash = 'AUTH-MF-00000000';

if ($isValid && $rental) {
    $rawItems = !empty($rental['items_json']) ? json_decode($rental['items_json'], true) : [];
    $items = is_array($rawItems) ? $rawItems : [];

    $rawDoc = $rental['client_document'] ?? '';
    $digits = preg_replace('/\D/', '', $rawDoc);
    if (strlen($digits) === 11) {
        $maskedDoc = '***.' . substr($digits, 3, 3) . '.' . substr($digits, 6, 3) . '-**';
    } elseif (strlen($digits) === 14) {
        $maskedDoc = substr($digits, 0, 2) . '.***.***/' . substr($digits, 8, 4) . '-**';
    } else {
        $maskedDoc = $rawDoc;
    }

    $authorizer = !empty($rental['created_by']) ? $rental['created_by'] : 'Gestão MegaFilmes';

    $strForHash = $rental['code'] . '-' . $rental['total_amount'] . '-' . $rental['start_date'] . '-' . $authorizer;
    $hash = 0;
    for ($i = 0; $i < strlen($strForHash); $i++) {
        $hash = ($hash * 31 + ord($strForHash[$i])) % 4294967296;
    }
    $authHash = 'AUTH-MF-' . strtoupper(str_pad(dechex($hash), 8, '0', STR_PAD_LEFT));
}

$isReserved = $isValid && ($rental['status'] === 'reserved');
$docTitle = $isReserved ? 'Comprovante de Agendamento & Reserva' : 'Contrato de Locação & Termo de Responsabilidade';
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= $isValid ? 'Autenticidade Confirmada • ' . htmlspecialchars($rental['code']) : 'Validação de Documento • MegaFilmes' ?></title>
  <link rel="icon" type="image/png" href="/favicon.png">
  <meta name="theme-color" content="#0b1120">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }

    body {
      background: #0b1120;
      color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 24px 16px;
      line-height: 1.5;
    }

    .verifier-wrap {
      width: 100%;
      max-width: 680px;
      margin: 0 auto;
    }

    /* Topo com Logo e Marca */
    .verifier-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 24px;
      text-align: center;
    }

    .brand-logo {
      height: 48px;
      width: auto;
      max-width: 220px;
      object-fit: contain;
      margin-bottom: 10px;
      filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
    }

    .brand-system {
      font-size: 0.82rem;
      font-weight: 700;
      color: #94a3b8;
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }

    /* Cartão Principal de Certificação */
    .cert-card {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05);
      overflow: hidden;
      margin-bottom: 20px;
    }

    /* Faixa de Status (Válido ou Inválido) */
    .cert-status-hero {
      padding: 28px 24px;
      text-align: center;
      position: relative;
    }

    .cert-status-hero.valid {
      background: linear-gradient(180deg, rgba(16, 185, 129, 0.18) 0%, rgba(15, 23, 42, 0) 100%);
      border-bottom: 1px solid rgba(16, 185, 129, 0.25);
    }

    .cert-status-hero.invalid {
      background: linear-gradient(180deg, rgba(239, 68, 68, 0.18) 0%, rgba(15, 23, 42, 0) 100%);
      border-bottom: 1px solid rgba(239, 68, 68, 0.25);
    }

    .status-icon-bubble {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    }

    .valid .status-icon-bubble {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #ffffff;
      box-shadow: 0 0 30px rgba(16, 185, 129, 0.45);
    }

    .invalid .status-icon-bubble {
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      color: #ffffff;
      box-shadow: 0 0 30px rgba(239, 68, 68, 0.45);
    }

    .status-badge-pill {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 8px;
    }

    .valid .status-badge-pill {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .invalid .status-badge-pill {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.4);
    }

    .cert-title {
      font-size: 1.45rem;
      font-weight: 900;
      letter-spacing: -0.02em;
      margin-bottom: 6px;
    }

    .valid .cert-title {
      color: #ffffff;
    }

    .invalid .cert-title {
      color: #fca5a5;
    }

    .cert-subtitle {
      font-size: 0.88rem;
      color: #94a3b8;
      max-width: 480px;
      margin: 0 auto;
    }

    /* Conteúdo dos Dados */
    .cert-body {
      padding: 24px;
    }

    .cert-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    }

    @media (max-width: 520px) {
      .cert-grid {
        grid-template-columns: 1fr;
      }
    }

    .cert-field {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 12px;
      padding: 12px 14px;
    }

    .field-lbl {
      display: block;
      font-size: 0.7rem;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }

    .field-val {
      font-size: 0.95rem;
      font-weight: 700;
      color: #f8fafc;
      word-break: break-word;
    }

    .field-val.highlight {
      color: #fbbf24;
      font-size: 1.15rem;
      font-weight: 900;
      letter-spacing: 0.5px;
    }

    .field-val.code {
      font-family: monospace;
      color: #38bdf8;
      font-weight: 800;
    }

    /* Seção de Itens Autorizados */
    .items-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .items-card-title {
      font-size: 0.8rem;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 0.88rem;
    }

    .item-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }

    .item-name {
      font-weight: 700;
      color: #f1f5f9;
    }

    .item-qty {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 800;
    }

    /* Chancela e Legislação */
    .legal-seal {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 20px;
    }

    .seal-icon {
      font-size: 1.6rem;
      line-height: 1;
    }

    .seal-text {
      font-size: 0.78rem;
      color: #cbd5e1;
      line-height: 1.45;
    }

    .seal-text strong {
      color: #ffffff;
    }

    /* Rodapé Institucional */
    .verifier-footer {
      text-align: center;
      font-size: 0.76rem;
      color: #64748b;
      margin-top: 12px;
      line-height: 1.5;
    }

    .verifier-footer strong {
      color: #94a3b8;
    }

    .btn-return {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #f1f5f9;
      padding: 9px 18px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 700;
      text-decoration: none;
      margin-top: 16px;
      transition: all 0.2s ease;
    }

    .btn-return:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      transform: translateY(-1px);
    }
  </style>
</head>
<body>

  <div class="verifier-wrap">
    
    <!-- Cabeçalho com Logo Oficial do Sistema (Mega Gestão) -->
    <header class="verifier-header">
      <img src="/images/logo-megagestao.png" alt="Mega Gestão" class="brand-logo" onerror="this.onerror=null;this.src='/logo.png';">
      <span class="brand-system">Mega Gestão • Certificação Digital de Documentos</span>
    </header>

    <?php if ($isValid && $rental): ?>
      <!-- Cartão quando o documento é AUTÊNTICO e VÁLIDO -->
      <main class="cert-card">
        
        <div class="cert-status-hero valid">
          <div class="status-icon-bubble">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </div>
          <span class="status-badge-pill">Verificação Concluída</span>
          <h1 class="cert-title">Documento Autêntico & Válido</h1>
          <p class="cert-subtitle">Registro eletrônico confirmado na base de dados oficial da MegaFilmes Produções Audiovisuais.</p>
        </div>

        <div class="cert-body">
          
          <div class="cert-grid">
            <div class="cert-field">
              <span class="field-lbl">Tipo de Instrumento</span>
              <span class="field-val"><?= htmlspecialchars($docTitle) ?></span>
            </div>

            <div class="cert-field">
              <span class="field-lbl">Código do Documento</span>
              <span class="field-val highlight"><?= htmlspecialchars($rental['code']) ?></span>
            </div>

            <div class="cert-field">
              <span class="field-lbl">Locatário(a) / Solicitante</span>
              <span class="field-val"><?= htmlspecialchars($rental['client_name']) ?></span>
            </div>

            <div class="cert-field">
              <span class="field-lbl">CPF / CNPJ (Proteção LGPD)</span>
              <span class="field-val code"><?= htmlspecialchars($maskedDoc ?: 'Não informado') ?></span>
            </div>

            <div class="cert-field">
              <span class="field-lbl">Período Autorizado</span>
              <span class="field-val">
                <?= date('d/m/Y', strtotime($rental['start_date'])) ?> às <?= htmlspecialchars($rental['start_time'] ?? '08:00') ?><br>
                até <?= date('d/m/Y', strtotime($rental['end_date'])) ?> às <?= htmlspecialchars($rental['end_time'] ?? '18:00') ?>
                (<?= (int)$rental['total_days'] ?> <?= (int)$rental['total_days'] === 1 ? 'diária' : 'diárias' ?>)
              </span>
            </div>

            <div class="cert-field">
              <span class="field-lbl">Status da Operação</span>
              <span class="field-val">
                <?php
                  $st = $rental['status'];
                  if ($st === 'active') echo '🟢 Locação Ativa / Em Andamento';
                  elseif ($st === 'reserved') echo '🟡 Reserva Prévia Agendada';
                  elseif ($st === 'returned') echo '🔵 Devolvido & Finalizado';
                  elseif ($st === 'overdue') echo '🔴 Prazo Vencido';
                  else echo htmlspecialchars(ucfirst($st));
                ?>
              </span>
            </div>

            <div class="cert-field">
              <span class="field-lbl">Autenticado Eletronicamente Por</span>
              <span class="field-val"><?= htmlspecialchars($authorizer) ?></span>
            </div>

            <div class="cert-field">
              <span class="field-lbl">Chave de Assinatura Digital</span>
              <span class="field-val code"><?= htmlspecialchars($authHash) ?></span>
            </div>
          </div>

          <!-- Relação de Itens Autorizados -->
          <?php if (!empty($items)): ?>
            <div class="items-card">
              <div class="items-card-title">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m7.5 4.27 9 5.15"/>
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                  <path d="m3.3 7 8.7 5 8.7-5"/>
                  <path d="M12 22V12"/>
                </svg>
                Equipamentos Constantes no Documento
              </div>
              <?php foreach ($items as $it): ?>
                <div class="item-row">
                  <span class="item-name"><?= htmlspecialchars($it['name'] ?? 'Equipamento') ?></span>
                  <span class="item-qty"><?= (int)($it['quantity'] ?? 1) ?> un.</span>
                </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>

          <!-- Selo de Validade Jurídica -->
          <div class="legal-seal">
            <span class="seal-icon">⚖️</span>
            <div class="seal-text">
              <strong>Validade Jurídica & Certificação Sistêmica:</strong><br>
              Este documento possui plena eficácia probatória em todo o território nacional, fundamentado nos 
              <strong>Arts. 565 a 578 da Lei Federal nº 10.406/2002 (Código Civil Brasileiro)</strong> e 
              <strong>Lei Federal nº 14.063/2020</strong> (Assinaturas Eletrônicas Avançadas).
            </div>
          </div>

        </div>

      </main>

    <?php else: ?>

      <!-- Cartão quando o documento é INVÁLIDO ou NÃO ENCONTRADO -->
      <main class="cert-card">
        <div class="cert-status-hero invalid">
          <div class="status-icon-bubble">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <span class="status-badge-pill">Verificação Negativa</span>
          <h1 class="cert-title">Documento Não Localizado</h1>
          <p class="cert-subtitle"><?= htmlspecialchars($errorMessage) ?></p>
        </div>

        <div class="cert-body" style="text-align: center;">
          <p style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 16px;">
            Se você está com um documento impresso ou digital da MegaFilmes em mãos, verifique se o QR Code foi lido corretamente ou entre em contato com a nossa administração para suporte.
          </p>

          <a href="/" class="btn-return">
            Ir para a Página Inicial
          </a>
        </div>
      </main>

    <?php endif; ?>

    <!-- Rodapé -->
    <footer class="verifier-footer">
      <strong>Mega Filmes e Fotografia (RG DA SILVA - ME)</strong><br>
      CNPJ: 21.973.641/0001-00 • Alameda dos Tatus, 155 - Dr. Silvio Leite, Boa Vista - RR<br>
      Sistema de Gestão & Locações GestorMF
    </footer>

  </div>

</body>
</html>

