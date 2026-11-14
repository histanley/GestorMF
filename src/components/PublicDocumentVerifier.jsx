import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Package, Calendar, User, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { formatCurrency, formatDateBR } from '../utils/rentalsData';

export default function PublicDocumentVerifier({ code = '' }) {
  const [loading, setLoading] = useState(true);
  const [docData, setDocData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDoc = async () => {
      if (!code) {
        setError('Nenhum código de documento fornecido para verificação.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/rentals.php?action=verify&code=${encodeURIComponent(code)}`);
        const json = await res.json();

        if (json.success && json.valid && json.document) {
          setDocData(json.document);
        } else {
          setError(json.message || 'Documento não localizado na base de dados oficial da MegaFilmes.');
        }
      } catch (err) {
        console.error('Erro ao verificar documento:', err);
        setError('Falha de conexão com o servidor de autenticação.');
      } finally {
        setLoading(false);
      }
    };

    fetchDoc();
  }, [code]);

  return (
    <div className="public-verifier-page">
      <div className="pv-container">
        
        {/* Cabeçalho com Logo Oficial do Sistema (Mega Gestão) */}
        <header className="pv-header">
          <img
            src="/images/logo-megagestao.png"
            alt="Mega Gestão"
            className="pv-logo"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/logo.png';
            }}
          />
          <span className="pv-brand-tag">Mega Gestão • Certificação Digital de Documentos</span>
        </header>

        {loading ? (
          <div className="pv-card pv-loading-card">
            <div className="pv-spinner"></div>
            <p>Consultando base de autenticidade oficial...</p>
          </div>
        ) : docData ? (
          <main className="pv-card">
            <div className="pv-hero valid">
              <div className="pv-icon-bubble valid">
                <ShieldCheck size={36} />
              </div>
              <span className="pv-badge-pill valid">Verificação Concluída</span>
              <h1 className="pv-title">Documento Autêntico &amp; Válido</h1>
              <p className="pv-subtitle">
                Registro eletrônico confirmado na base de dados oficial da MegaFilmes Produções Audiovisuais.
              </p>
            </div>

            <div className="pv-body">
              <div className="pv-grid">
                <div className="pv-field">
                  <span className="pv-lbl">Tipo de Instrumento</span>
                  <span className="pv-val">{docData.type}</span>
                </div>

                <div className="pv-field">
                  <span className="pv-lbl">Código do Documento</span>
                  <span className="pv-val highlight">{docData.code}</span>
                </div>

                <div className="pv-field">
                  <span className="pv-lbl">Locatário(a) / Solicitante</span>
                  <span className="pv-val">{docData.clientName}</span>
                </div>

                <div className="pv-field">
                  <span className="pv-lbl">CPF / CNPJ (Proteção LGPD)</span>
                  <span className="pv-val mono">{docData.clientDocumentMasked || 'Não informado'}</span>
                </div>

                <div className="pv-field">
                  <span className="pv-lbl">Período Autorizado</span>
                  <span className="pv-val">
                    {formatDateBR(docData.startDate)} às {docData.startTime}<br />
                    até {formatDateBR(docData.endDate)} às {docData.endTime} ({docData.totalDays} {docData.totalDays === 1 ? 'diária' : 'diárias'})
                  </span>
                </div>

                <div className="pv-field">
                  <span className="pv-lbl">Status da Operação</span>
                  <span className="pv-val">
                    {docData.status === 'active' && '🟢 Locação Ativa / Em Andamento'}
                    {docData.status === 'reserved' && '🟡 Reserva Prévia Agendada'}
                    {docData.status === 'returned' && '🔵 Devolvido & Finalizado'}
                    {docData.status === 'overdue' && '🔴 Prazo Vencido'}
                    {!['active', 'reserved', 'returned', 'overdue'].includes(docData.status) && docData.status}
                  </span>
                </div>

                <div className="pv-field">
                  <span className="pv-lbl">Autenticado Eletronicamente Por</span>
                  <span className="pv-val">{docData.authorizedBy}</span>
                </div>

                <div className="pv-field">
                  <span className="pv-lbl">Chave de Assinatura Digital</span>
                  <span className="pv-val mono">{docData.authSignature || 'AUTH-MF-VALID'}</span>
                </div>
              </div>

              {/* Equipamentos */}
              {docData.items && docData.items.length > 0 && (
                <div className="pv-items-section">
                  <h3 className="pv-items-title">
                    <Package size={14} /> Equipamentos Constantes no Documento
                  </h3>
                  <div className="pv-items-list">
                    {docData.items.map((it, idx) => (
                      <div key={idx} className="pv-item-row">
                        <span className="pv-item-name">{it.name}</span>
                        <span className="pv-item-qty">{it.quantity} un.</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selo Jurídico */}
              <div className="pv-legal-seal">
                <span className="pv-seal-icon">⚖️</span>
                <p className="pv-seal-text">
                  <strong>Validade Jurídica &amp; Certificação Sistêmica:</strong><br />
                  Este documento possui plena eficácia probatória em todo o território nacional, fundamentado nos 
                  <strong> Arts. 565 a 578 da Lei Federal nº 10.406/2002 (Código Civil Brasileiro)</strong> e 
                  <strong> Lei Federal nº 14.063/2020</strong> (Assinaturas Eletrônicas Avançadas).
                </p>
              </div>
            </div>
          </main>
        ) : (
          <main className="pv-card">
            <div className="pv-hero invalid">
              <div className="pv-icon-bubble invalid">
                <AlertTriangle size={36} />
              </div>
              <span className="pv-badge-pill invalid">Verificação Negativa</span>
              <h1 className="pv-title">Documento Não Localizado</h1>
              <p className="pv-subtitle">{error}</p>
            </div>

            <div className="pv-body" style={{ textAlign: 'center' }}>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '16px' }}>
                Se você está com um documento impresso ou digital da MegaFilmes em mãos, certifique-se de que o QR Code foi lido corretamente ou entre em contato com a equipe de gestão.
              </p>
              <a href="/" className="pv-btn-home">
                <ArrowLeft size={15} /> Ir para a Página Inicial
              </a>
            </div>
          </main>
        )}

        {/* Rodapé */}
        <footer className="pv-footer">
          <strong>Mega Filmes e Fotografia (RG DA SILVA - ME)</strong><br />
          CNPJ: 21.973.641/0001-00 • Alameda dos Tatus, 155 - Dr. Silvio Leite, Boa Vista - RR<br />
          Sistema de Gestão &amp; Locações GestorMF
        </footer>

      </div>
    </div>
  );
}

