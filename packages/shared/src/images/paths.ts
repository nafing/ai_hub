export const imageApiPaths = {
  characterAvatar: (characterId: string) =>
    `/images/character-avatars/${characterId}`,
  personaAvatar: (personaId: string) => `/images/persona-avatars/${personaId}`,
  characterGalleryCollection: (characterId: string) =>
    `/images/character-gallery/${characterId}`,
  characterGallery: (characterId: string, imageId: string) =>
    `/images/character-gallery/${characterId}/${imageId}`,
  chatAttachment: (chatId: string, attachmentId: string) =>
    `/images/chat-attachments/${chatId}/${attachmentId}`,
  chatAttachments: (chatId: string) => `/images/chat-attachments/${chatId}`,
  twatterPost: (postId: string) => `/images/twatter-posts/${postId}`,
} as const;
