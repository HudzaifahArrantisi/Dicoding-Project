export const DAISUKI_AI_IDENTITY_REPLY = "Saya Daisuki AI Assistant, asisten AI untuk mitra Daisuki. Saya membantu Anda memeriksa stok, pesanan restock, dan panduan aplikasi berdasarkan data cabang Anda. Model klasifikasi Multinomial Naive Bayes dalam daisuki.pkl membantu mengenali pertanyaan dan risiko stok.";

const identityQuestion = /\b(?:siapa(?:\s*kah)?\s+(?:kamu|anda|diri\s*(?:mu|nya)|dia|ini|asisten\s+ini|chatbot\s+ini|bot\s+ini)|(?:kamu|anda|diri\s*(?:mu|nya)|dia|chatbot\s+ini|asisten\s+ini)\s+siapa(?:\s*kah)?|(?:diri\s*(?:mu|nya)|kamu|anda|dia|chatbot\s+ini|asisten\s+ini)\s+(?:itu\s+)?apa|apa\s+(?:identitas(?:mu|nya)?|nama(?:mu|nya)?|nama\s+(?:ai|asisten|bot)\s+ini)|perkenalkan\s+diri(?:mu)?|kenalan\s+dong|dengan\s+siapa\s+saya\s+(?:bicara|berbicara)|(?:kamu|anda)\s+(?:sistem|robot|bot|ai)\s+apa|apakah\s+(?:kamu|anda)\s+ai|tentang\s+(?:kamu|anda|asisten|bot)|profil\s+(?:ai|asisten|kamu|anda)|apa\s+itu\s+daisuki(?:[.\s]?pkl)?|daisuki[.\s]?pkl)\b/i;

export function isAssistantIdentityQuestion(message: string): boolean {
  return identityQuestion.test(message.toLowerCase().replace(/[^\p{L}\p{N}.]+/gu, " ").trim());
}
