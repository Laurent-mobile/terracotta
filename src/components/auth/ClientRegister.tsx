// src/components/auth/ClientRegister.tsx
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    User,
    Mail,
    Phone,
    Lock,
    Eye,
    EyeOff,
    CheckCircle,
    AlertCircle,
    ArrowLeft,
    Loader2,
    Building
} from 'lucide-react';

interface ClientRegisterProps {
    onSuccess?: () => void;
    onBackToLogin?: () => void;
}

export default function ClientRegister({ onSuccess, onBackToLogin }: ClientRegisterProps) {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        phone: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validations
        if (!formData.email.trim()) {
            setError('L\'email est requis');
            return;
        }

        if (!formData.password || formData.password.length < 6) {
            setError('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            return;
        }

        if (!formData.fullName.trim()) {
            setError('Le nom complet est requis');
            return;
        }

        if (!formData.phone.trim()) {
            setError('Le numéro de téléphone est requis');
            return;
        }

        if (!termsAccepted) {
            setError('Vous devez accepter les conditions d\'utilisation');
            return;
        }

        setLoading(true);

        try {
            // 1. Créer l'utilisateur
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        phone: formData.phone,
                        role: 'client'
                    }
                }
            });

            if (authError) throw authError;

            if (authData.user) {
                // 2. Confirmer l'email automatiquement (si admin)
                // Note: Cela nécessite les droits admin
                try {
                    const { error: confirmError } = await supabase.auth.admin.updateUserById(
                        authData.user.id,
                        { email_confirm: true }
                    );
                    if (confirmError) {
                        console.warn('⚠️ Impossible de confirmer automatiquement l\'email');
                    }
                } catch (adminError) {
                    console.warn('⚠️ Fonction admin non disponible');
                }

                // 3. Créer le profil
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: authData.user.id,
                        email: formData.email.trim().toLowerCase(),
                        full_name: formData.fullName,
                        phone: formData.phone,
                        role: 'client',
                        created_at: new Date().toISOString()
                    });

                if (profileError) {
                    console.error('Erreur création profil:', profileError);
                    throw new Error('Erreur lors de la création du profil');
                }

                setSuccess(true);
                setTimeout(() => {
                    if (onSuccess) onSuccess();
                }, 2000);
            }
        } catch (err: any) {
            console.error('Erreur inscription:', err);

            if (err.message.includes('User already registered')) {
                setError('Cet email est déjà utilisé. Veuillez vous connecter.');
            } else if (err.message.includes('Password should be at least')) {
                setError('Le mot de passe doit contenir au moins 6 caractères');
            } else {
                setError(err.message || 'Erreur lors de l\'inscription');
            }
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">✅ Inscription réussie !</h2>
                    <p className="text-gray-600 mb-4">
                        Un email de confirmation a été envoyé à <strong>{formData.email}</strong>
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        Veuillez vérifier votre boîte mail et confirmer votre compte.
                    </p>
                    <button
                        onClick={onBackToLogin}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center"
                    >
                        <ArrowLeft className="w-5 h-5 mr-2" />
                        Aller à la connexion
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
                {/* Bouton retour */}
                <button
                    onClick={onBackToLogin}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-6 transition"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Retour à la connexion
                </button>

                {/* En-tête */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <User className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Créer un compte client</h2>
                    <p className="text-gray-600 mt-1">
                        Inscrivez-vous pour passer des commandes en ligne
                    </p>
                </div>

                {/* Formulaire */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Nom complet */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nom complet *
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                value={formData.fullName}
                                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Jean Dupont"
                                required
                            />
                        </div>
                    </div>

                    {/* Téléphone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Téléphone *
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="0123456789"
                                required
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email *
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="client@email.com"
                                required
                            />
                        </div>
                    </div>

                    {/* Mot de passe */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Mot de passe *
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Min. 6 caractères"
                                required
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            🔒 Minimum 6 caractères
                        </p>
                    </div>

                    {/* Confirmation mot de passe */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Confirmer le mot de passe *
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Confirmer le mot de passe"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Conditions */}
                    <div className="flex items-start space-x-2">
                        <input
                            type="checkbox"
                            id="terms"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="terms" className="text-sm text-gray-600">
                            J'accepte les{' '}
                            <a href="#" className="text-blue-600 hover:underline">
                                conditions d'utilisation
                            </a>
                            {' '}et la{' '}
                            <a href="#" className="text-blue-600 hover:underline">
                                politique de confidentialité
                            </a>
                        </label>
                    </div>

                    {/* Erreur */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start">
                            <AlertCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Bouton d'inscription */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Inscription en cours...
                            </>
                        ) : (
                            'Créer mon compte'
                        )}
                    </button>

                    {/* Message de séparation */}
                    <div className="text-center">
                        <p className="text-xs text-gray-400">
                            📱 Vous recevrez une confirmation par email
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}