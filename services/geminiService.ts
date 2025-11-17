
import { GoogleGenAI } from "@google/genai";
import { MonthlyStats } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateMonthlyAnalysis = async (
  stats: MonthlyStats,
  workerName: string,
  monthName: string
): Promise<string> => {
  if (!process.env.API_KEY) {
      return "Chave de API não configurada. A análise IA está desativada.";
  }
  try {
    const prompt = `
      Você é um assistente financeiro para um trabalhador autônomo chamado ${workerName || 'o usuário'}.
      Analise os dados do mês de ${monthName}:
      - Total Bruto: R$ ${stats.grossTotal.toFixed(2)}
      - Adiantamentos: R$ ${stats.totalAdvances.toFixed(2)}
      - Salário Líquido Final: R$ ${stats.finalTotal.toFixed(2)}

      Dê um feedback curto (2-3 frases), motivador e profissional.
      Se os adiantamentos forem altos, dê um alerta amigável.
      Se o resultado for bom, parabenize.
    `;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return response.text;
  } catch (error) {
    console.error("Error generating monthly analysis:", error);
    return "Erro ao conectar com a IA. Verifique sua conexão ou a chave de API.";
  }
};

export const generateBossMessage = async (
  stats: MonthlyStats,
  workerName: string,
  employerName: string,
  monthName: string
): Promise<string> => {
    if (!process.env.API_KEY) {
        return "";
    }
    try {
        const prompt = `
          Escreva uma mensagem curta e formal para enviar no WhatsApp para o patrão (${employerName || 'Patrão'}).
          O remetente é ${workerName || 'o funcionário'}.
          Assunto: Envio do relatório mensal de ${monthName}.
          Valor final a receber: R$ ${stats.finalTotal.toFixed(2)}.
          A mensagem deve ser educada, informar que o PDF com detalhes está em anexo (simbolicamente) e solicitar a confirmação.
        `;
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
        return response.text;
     } catch (e) {
         console.error("Error generating boss message:", e);
         return "Não foi possível gerar a mensagem.";
     }
}
