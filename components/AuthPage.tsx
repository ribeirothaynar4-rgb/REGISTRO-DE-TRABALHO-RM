
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Mail, Lock, ArrowRight, Loader2, UserPlus, LogIn, AlertCircle, KeyRound, ArrowLeft, Send } from 'lucide-react';

const AuthPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isReset, setIsReset] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isReset) {
        // Fluxo de reset removido em favor do botão de contato manual
        return; 
      } else if (isSignUp) {
        // Lógica de Cadastro
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setSuccessMsg('Cadastro realizado! Verifique seu e-mail para confirmar.');
      } else {
        // Lógica de Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Ocorreu um erro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const toggleReset = () => {
    setIsReset(!isReset);
    setIsSignUp(false);
    setErrorMsg(null);
    setSuccessMsg(null);
    setPassword('');
  };

  const handleGmailClick = () => {
      const emailTo = "roniellloliveira123@gmail.com";
      const subject = encodeURIComponent("Recuperação de Senha - Meu Registro de Trabalho");
      const body = encodeURIComponent("Olá suporte, esqueci minha senha e gostaria de solicitar a recuperação da minha conta.");
      
      // Usa a URL específica do Gmail para compor mensagem. 
      // Isso evita abrir o app padrão de email (como Mail do iOS ou Outlook) e direciona para o Gmail.
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${emailTo}&su=${subject}&body=${body}`;
      
      window.open(gmailUrl, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 font-sans relative overflow-hidden">
      
      {/* Background Decorativo */}
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-violet-600 to-indigo-600 rounded-b-[3rem] shadow-2xl z-0"></div>
      
      <div className="w-full max-w-sm z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        
        <div className="text-center mb-8">
            <div className="bg-white/20 backdrop-blur-md p-4 rounded-3xl inline-block mb-4 shadow-lg border border-white/20">
                {isReset ? (
                    <KeyRound className="w-10 h-10 text-white" />
                ) : (
                    <LogIn className="w-10 h-10 text-white" />
                )}
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
                {isReset ? 'Suporte' : 'Bem-vindo(a)'}
            </h1>
            <p className="text-indigo-100 mt-2 font-medium opacity-90">
                {isReset 
                    ? 'Entre em contato para recuperar seu acesso.' 
                    : 'Controle seus dias trabalhados e finanças de forma profissional.'}
            </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-8 border border-slate-100 dark:border-slate-800">
          
          {/* Toggle Login/Cadastro - Oculto se estiver no modo Reset */}
          {!isReset && (
              <div className="flex justify-center mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                    onClick={() => { setIsSignUp(false); setErrorMsg(null); setSuccessMsg(null); }}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isSignUp ? 'bg-white dark:bg-slate-700 shadow text-violet-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    Entrar
                </button>
                <button
                    onClick={() => { setIsSignUp(true); setErrorMsg(null); setSuccessMsg(null); }}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isSignUp ? 'bg-white dark:bg-slate-700 shadow text-violet-600 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                >
                    Criar Conta
                </button>
              </div>
          )}

          {isReset ? (
            // Layout da tela de recuperação (Contato Gmail)
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800 rounded-xl p-4 text-center">
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                        Para garantir a segurança da sua conta, a redefinição de senha é feita manualmente pela nossa equipe.
                    </p>
                    <p className="text-xs font-bold text-violet-600 dark:text-violet-400">
                        Envie um e-mail solicitando a recuperação.
                    </p>
                </div>

                <button
                    onClick={handleGmailClick}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-200 dark:shadow-none transition-all transform active:scale-95 flex items-center justify-center space-x-3"
                >
                    <Mail className="w-6 h-6" />
                    <span>Abrir Gmail</span>
                </button>
            </div>
          ) : (
            // Layout do Formulário de Login/Cadastro
            <form onSubmit={handleAuth} className="space-y-5">
                <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">E-mail</label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-violet-400" />
                    </div>
                    <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all outline-none text-slate-800 dark:text-white"
                    placeholder="seu@email.com"
                    required
                    />
                </div>
                </div>

                <div className="animate-in fade-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-1 ml-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase">Senha</label>
                            {!isSignUp && (
                            <button 
                                type="button"
                                onClick={toggleReset}
                                className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                            >
                                Esqueci a senha
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-violet-400" />
                        </div>
                        <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-10 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all outline-none text-slate-800 dark:text-white"
                        placeholder="••••••••"
                        required
                        minLength={6}
                        />
                    </div>
                </div>

                {errorMsg && (
                    <div className="bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 p-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {errorMsg}
                    </div>
                )}

                {successMsg && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 p-3 rounded-xl text-xs font-medium flex items-center gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        {successMsg}
                    </div>
                )}

                <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-violet-200 dark:shadow-none transition-all transform active:scale-95 flex items-center justify-center space-x-2"
                >
                {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                    <>
                    <span>{isSignUp ? 'Cadastrar Grátis' : 'Acessar App'}</span>
                    {!isSignUp && <ArrowRight className="w-5 h-5" />}
                    {isSignUp && <UserPlus className="w-5 h-5" />}
                    </>
                )}
                </button>
            </form>
          )}

          {/* Botão de Voltar ao Login (Modo Reset) */}
          {isReset && (
            <div className="mt-6 text-center">
                <button 
                    onClick={toggleReset}
                    className="text-sm font-bold text-slate-500 hover:text-violet-600 transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para Login
                </button>
            </div>
          )}
        </div>
        
        <p className="text-center text-slate-400 text-xs mt-8">
            Desenvolvido por <span className="text-violet-600 dark:text-violet-400 font-bold">Roniel N.</span>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
