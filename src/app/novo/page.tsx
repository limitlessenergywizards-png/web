"use client";

import { useState } from "react";
import { Check, ArrowRight, ArrowLeft, Wand2, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const TOTAL_STEPS = 3;

export default function NovoBriefing() {
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        title: "",
        priority: "MEDIUM",
        hook1: "",
        hook2: "",
        hook3: "",
        bodyText: "",
        avatarGender: "MALE",
        tone: "SERIOUS",
        scenario: "",
        dialect: "PT_BR",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleNext = () => {
        if (step < TOTAL_STEPS) setStep((s) => s + 1);
    };

    const handlePrev = () => {
        if (step > 1) setStep((s) => s - 1);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setErrors([]);

        // Simulate API Call to Supabase / Backend Next Action
        try {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            // throw new Error("Falha ao simular envio do banco de dados");
            window.location.href = "/"; // Redirect on success
        } catch (err: any) {
            setErrors([err.message || "Erro desconhecido ao processar briefing."]);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-6 pt-10 pb-20 relative">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Criar Novo Briefing</h1>
                <p className="text-slate-400">Configure os parâmetros da sua nova head de anúncios.</p>

                {/* Progress Stepper */}
                <div className="mt-8">
                    <div className="flex justify-between mb-3">
                        {["Setup da Campanha", "Roteiro (Copy)", "Direção de Arte"].map((title, i) => {
                            const currentStep = i + 1;
                            const isPast = step > currentStep;
                            const isActive = step === currentStep;

                            return (
                                <div key={title} className="flex items-center gap-2" onClick={() => (isPast ? setStep(currentStep) : null)} style={{ cursor: isPast ? 'pointer' : 'default' }}>
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-all",
                                        isActive ? "border-blue-500 bg-blue-500/10 text-blue-500" :
                                            isPast ? "border-blue-500 bg-blue-500 text-white" :
                                                "border-slate-700 bg-slate-800 text-slate-500"
                                    )}>
                                        {isPast ? <Check className="w-4 h-4" /> : currentStep}
                                    </div>
                                    <span className={cn(
                                        "text-sm font-medium hidden md:block",
                                        isActive ? "text-blue-500" : isPast ? "text-slate-300" : "text-slate-500"
                                    )}>{title}</span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all duration-500 ease-out"
                            style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">

                {errors.length > 0 && (
                    <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm">
                        <h4 className="font-bold flex items-center gap-2 mb-2"><AlertCircle className="w-5 h-5" /> Encontramos alguns problemas:</h4>
                        <ul className="list-disc pl-5 space-y-1">
                            {errors.map((e, idx) => <li key={idx}>{e}</li>)}
                        </ul>
                    </div>
                )}

                <div className="min-h-[400px]">
                    <AnimatePresence mode="wait">

                        {/* STEP 1 */}
                        {step === 1 && (
                            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-6 border-b border-slate-700 pb-2">Setup da Campanha</h2>

                                <div className="space-y-2">
                                    <label className="text-slate-300 text-sm font-medium">Título Interno do Projeto</label>
                                    <input required name="title" value={formData.title} onChange={handleChange} placeholder="Ex: PB-ES_Quarto_20260215" className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-gray-100 placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors" />
                                    <p className="text-slate-500 text-xs">Siga a nomenclatura padrão: PB-ES_[Oferta]_[Data]</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-slate-300 text-sm font-medium">Prioridade</label>
                                    <select name="priority" value={formData.priority} onChange={handleChange} className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors appearance-none">
                                        <option value="LOW">Baixa</option>
                                        <option value="MEDIUM">Média</option>
                                        <option value="HIGH">Alta (Urgente)</option>
                                    </select>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2 */}
                        {step === 2 && (
                            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-2 border-b border-slate-700 pb-2">Roteiro (Copy)</h2>
                                <p className="text-slate-400 text-sm mb-6">Escreva os ganchos e corpo do anúncio. Máx. 150 caracteres para ganchos.</p>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[1, 2, 3].map((num) => {
                                        const fieldName = `hook${num}` as keyof typeof formData;
                                        const val = formData[fieldName];
                                        const count = val.length;
                                        return (
                                            <div key={num} className="space-y-2">
                                                <div className="flex justify-between items-center text-sm">
                                                    <label className="text-slate-300 font-medium">Hook {num}</label>
                                                    <span className={cn("text-xs font-bold", count > 150 ? "text-rose-400" : "text-slate-500")}>{count}/150</span>
                                                </div>
                                                <textarea name={fieldName} value={val} onChange={handleChange} rows={3} placeholder={`Gancho ${num}...`} className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors resize-none" />
                                            </div>
                                        )
                                    })}
                                </div>

                                <div className="space-y-2 mt-4">
                                    <div className="flex justify-between items-center text-sm">
                                        <label className="text-slate-300 font-medium">Corpo Principal</label>
                                        <span className={cn("text-xs font-bold", formData.bodyText.length > 2000 ? "text-rose-400" : "text-slate-500")}>{formData.bodyText.length}/2000</span>
                                    </div>
                                    <textarea name="bodyText" value={formData.bodyText} onChange={handleChange} rows={6} placeholder="Desenvolvimento da copy do Anúncio..." className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-colors resize-none" />
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 3 */}
                        {step === 3 && (
                            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                                <h2 className="text-xl font-semibold text-white mb-6 border-b border-slate-700 pb-2">Direção de Arte & Meta</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-slate-300 text-sm font-medium">Gênero do Avatar</label>
                                        <select name="avatarGender" value={formData.avatarGender} onChange={handleChange} className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors">
                                            <option value="MALE">Masculino</option>
                                            <option value="FEMALE">Feminino</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-slate-300 text-sm font-medium">Tom de Voz</label>
                                        <select name="tone" value={formData.tone} onChange={handleChange} className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors">
                                            <option value="SERIOUS">Sério / Autoridade</option>
                                            <option value="CASUAL">Casual / Relaxado</option>
                                            <option value="URGENT">Urgência / Escassez</option>
                                            <option value="EXCITED">Animado / Emocionado</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2 md:col-span-2">
                                        <label className="text-slate-300 text-sm font-medium">Cenário / Ambiente</label>
                                        <input name="scenario" value={formData.scenario} onChange={handleChange} placeholder="Ex: Quarto gamer com LEDs azuis de fundo..." className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-4 py-3 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer Actions */}
                <div className="mt-8 pt-6 border-t border-slate-700/50 flex justify-between items-center relative z-10 bg-slate-800">

                    <button type="button" onClick={handlePrev} className={cn("px-5 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 transition flex items-center gap-2", step === 1 && "opacity-0 pointer-events-none")}>
                        <ArrowLeft className="w-4 h-4" /> Voltar
                    </button>

                    {step < TOTAL_STEPS && (
                        <button type="button" onClick={handleNext} className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition flex items-center gap-2">
                            Avançar <ArrowRight className="w-4 h-4" />
                        </button>
                    )}

                    {step === TOTAL_STEPS && (
                        <button type="submit" disabled={isSubmitting} className={cn("px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/20 transition flex items-center gap-2", isSubmitting && "opacity-80 cursor-wait")}>
                            {!isSubmitting ? <><Wand2 className="w-4 h-4" /> Finalizar Briefing</> : <><Loader2 className="w-4 h-4 animate-spin" /> Injetando Pipeline...</>}
                        </button>
                    )}
                </div>

                {/* Loading Overlay */}
                <AnimatePresence>
                    {isSubmitting && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl">
                            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Processando na Asavia...</h3>
                            <p className="text-slate-400 text-center max-w-sm">Aguarde enquanto validamos os scripts e chamamos a Edge Function.</p>
                        </motion.div>
                    )}
                </AnimatePresence>

            </form>
        </div>
    );
}
