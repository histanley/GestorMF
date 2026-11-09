import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  Sun,
  Moon,
  ArrowRight,
  AlertCircle
} from 'lucide-react';
import logoDark from '../assets/logo-dark.png';
import logoLight from '../assets/logo-light.png';
import { apiLogin } from '../utils/api';
import { SYSTEM_NAME, SYSTEM_TAGLINE, SYSTEM_VERSION, getSystemVersionString } from '../utils/version';

export default function LoginScreen({ theme, toggleTheme, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg('Por favor, informe seu e-mail e senha de acesso.');
      return;
    }

    setIsLoading(true);

    try {
      const apiRes = await apiLogin(cleanEmail, password);
      setIsLoading(false);

      if (apiRes.success && apiRes.user) {
        onLoginSuccess(apiRes.user);
        return;
      }

      setErrorMsg(apiRes.error || 'Credenciais inválidas. Verifique seu e-mail e senha.');
    } catch (err) {
      setIsLoading(false);
      setErrorMsg('Falha de conexão com o servidor. Verifique sua internet ou tente novamente.');
    }
  };

  return (
    <div className={`login-page-container ${theme === 'light' ? 'login-light' : 'login-dark'}`}>
      {/* Luzes de Fundo Decorativas (Ambient Glow) */}
      <div className="login-ambient-glow glow-top-left" />
      <div className="login-ambient-glow glow-bottom-right" />

      {/* Barra Superior com Botão de Alternância de Tema */}
      <header className="login-top-bar">
        <div className="login-system-pill">
          <span className="login-system-dot" />
          <span>{getSystemVersionString()}</span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className={`login-theme-toggle ${theme === 'light' ? 'is-light' : 'is-dark'}`}
          title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
          aria-label="Alternar Tema"
        >
          <span className="login-theme-icon">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </span>
          <span className="login-theme-label">
            {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          </span>
        </button>
      </header>

      {/* Caixa Central de Login */}
      <main className="login-content-wrapper">
        <div className="login-card">
          {/* Cabeçalho do Card com Logo */}
          <div className="login-card-header">
            <div className="login-logo-container">
              <img
                src={theme === 'light' ? logoLight : logoDark}
                alt="MegaGestão Logo"
                className="login-brand-logo"
              />
            </div>
            <p className="login-card-subtitle">
              Gestão Integrada de Frotas, Pautas, Equipes e Missões em Tempo Real
            </p>
          </div>

          {/* Mensagem de Erro com Animação */}
          {errorMsg && (
            <div className="login-alert-error" role="alert">
              <AlertCircle size={17} className="alert-error-icon" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Formulário Principal */}
          <form onSubmit={handleFormSubmit} className="login-form">
            <div className="login-field-group">
              <label htmlFor="login-email" className="login-label">
                E-mail Corporativo
              </label>
              <div className="login-input-box">
                <Mail size={17} className="login-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  className="login-input"
                  placeholder="admin@gestormf.shop ou seu e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="login-field-group">
              <div className="login-label-row">
                <label htmlFor="login-password" className="login-label">
                  Senha de Acesso
                </label>
              </div>
              <div className="login-input-box">
                <Lock size={17} className="login-input-icon" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input"
                  placeholder="Digite sua senha..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="login-options-row">
              <label className="login-remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Lembrar minhas credenciais</span>
              </label>
            </div>

            <button
              type="submit"
              className="btn-login-submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="login-loading-spinner" />
              ) : (
                <>
                  <span>Entrar no Sistema</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Rodapé Dinâmico: Ano atualizado 100% automaticamente via Date().getFullYear() */}
        <footer className="login-page-footer">
          <p>©{new Date().getFullYear()} ComputerSky | Feito com muito ❤️ e ☕</p>
        </footer>
      </main>
    </div>
  );
}

