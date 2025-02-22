import type {
  ApiChatFolder, ApiFormattedText, ApiMessageEntity, ApiMessageEntityCustomEmoji,
} from '../api/types';
import type { IconName } from '../types/icons';
import { ApiMessageEntityTypes } from '../api/types';

import { ALL_FOLDER_ID } from '../config';

export const API_ACCEPTED_EMOTICONS_LIST = [
  '🐱', '📕', '💰', '🎮', '💡', /* thumbs up must be here, but it does not get saved somehow! After chosing it from the desktop app it just does not get saved on the telegram server or does not get sent with the folder data */
  '🎵', '🎨', '✈', '⚽', '⭐', '🎓',
  '🛫', '👤', '👥', '💬', '✅', '🤖',
  '👑', '🌹', '🏠', '❤', '🎭', '🍸',
  '📈', '💼', '🔔', '📢', '📁', '📋',
];

export const EMOTICON_TO_ICON_NAME_MAP: { [key: string]: IconName } = {
  '💬': 'chats-chatfolders-filled',
  '✅': 'chat-chatfolders-filled',
  '👤': 'user-chatfolders-filled',
  '👥': 'group-chatfolders-filled',
  '⭐': 'star-chatfolders-filled',
  '📢': 'channel-chatfolders-filled',
  '🤖': 'bot-chatfolders-filled',
  '📁': 'folder-chatfolders-filled',
};

export const ICON_NAME_TO_EMOTICON_MAP: { [key: string]: string } = Object.fromEntries(
  Object.entries(EMOTICON_TO_ICON_NAME_MAP).map(([emoticon, iconName]) => [iconName, emoticon]),
);

const LEADING_EMOJI_REGEXP = /^(\p{Emoji}\uFE0F|\p{Emoji_Presentation})/gu;
// const EMOJI_REGEXP = /(\p{Emoji}\uFE0F|\p{Emoji_Presentation})/gu;

// Functions below are created to abstract folder icon handling while the API is not yet ready to accept custom emojis and all other 'unaccepted' emojis
// ATM, the logic is like this:
// If you want to see an emoji as a folder icon, you have to put it into the folder title text + 'emoticon' field.
// If you want to see a custom emoji as a folder icon, you have to put it into the folder title text + title entity with offset 0 + 'emoticon' field.
// If you want to see an SVG icon as a folder icon, you have to put it only in the 'emoticon' field.
// Backwards logic:
// If there is a leading emoji in the title and there is a title entity with offset 0 and type CustomEmoji - render a custom emoji as a folder icon
// If there is a leading emoji in the title and there is no title entity with offset 0 and type CustomEmoji - render a native / non-custom emoji as a folder icon
// If there is no leading emoji in the title - check for folder 'emoticon' field - if it's there - render is via <Icon> component after mapping with EMOTICON_TO_ICON_NAME_MAP
// If there is no 'emoticon' field for a folder - use some standard auto-resolved icon
//
// All the workaround-specific things with emojis as folder icons are gathered here
// For custom emoji entity persistense (documentId) - could use 'saved messages' or 'chat with self' for persistense between browsers and machines, but whatever - it's a hack

export function getChatFolderIconName(
  folder: Partial<
  Pick<ApiChatFolder, 'id' | 'emoticon' | 'bots' | 'groups' | 'channels' | 'contacts' | 'nonContacts' | 'excludeRead'>
  >,
): IconName {
  if (folder.emoticon && EMOTICON_TO_ICON_NAME_MAP[folder.emoticon]) {
    return EMOTICON_TO_ICON_NAME_MAP[folder.emoticon];
  // This behaviour should be properly aligned with the desktop and other clients icon auto-assign (which does not put any 'emoticon' field data)
  } else if (folder.id === ALL_FOLDER_ID) {
    return 'chats-chatfolders-filled';
  } else if (folder.bots) {
    return 'bot-chatfolders-filled';
  } else if (folder.groups) {
    return 'group-chatfolders-filled';
  } else if (folder.channels) {
    return 'channel-chatfolders-filled';
  } else if (folder.contacts) {
    return 'user-chatfolders-filled';
  } else if (folder.nonContacts) {
    return 'user-chatfolders-filled';
  } else if (folder.excludeRead) {
    return 'chat-chatfolders-filled';
  } else {
    return 'folder-chatfolders-filled';
  }
}

function getLeadingEmoji(str: string): string | undefined {
  const match = str.match(LEADING_EMOJI_REGEXP);
  return match ? match[0] : undefined;
}

function spliceEmoticonIntoChatFolderTitle(
  title: ApiFormattedText,
  emoticon: string,
  customEmojiId?: ApiMessageEntityCustomEmoji['documentId'],
): ApiFormattedText {
  let newTitleText = title.text;
  const newTitleEntities: ApiMessageEntity[] = title.entities?.filter((entity) => !(
    entity.type === ApiMessageEntityTypes.CustomEmoji
    && entity.offset === 0
  )) ?? [];

  if (customEmojiId) {
    // these entities get deleted somewhere on the telegram server side. They get accepted, but then either not saved or deleted.
    // These lines are left here for consistency
    newTitleEntities.push({
      type: ApiMessageEntityTypes.CustomEmoji,
      offset: 0,
      length: emoticon.length,
      documentId: customEmojiId,
    });
  }

  const leadingEmoji = getLeadingEmoji(newTitleText);
  if (leadingEmoji) {
    newTitleText = newTitleText.slice(leadingEmoji.length);
  }
  newTitleText = `${emoticon}${newTitleText}`;

  return { text: newTitleText, entities: newTitleEntities };
}

/**
 * Workaround to somehow persist chat folder custom emoji entity
 *
 * Could use message for chat with self for cross-machine persistense, but it's still too much of a dirty hack
 *
 * If no folderId is provided (for example, new folder got created) - will use the title text as a temporary key
 */
export function persistChatFolderCustomEmojiEntity(
  folder: Pick<ApiChatFolder, 'title'>,
  folderId?: ApiChatFolder['id'],
): void {
  const customEmojiEntity = folder.title.entities?.find(
    (entity) => entity.type === ApiMessageEntityTypes.CustomEmoji && entity.offset === 0,
  );
  if (!customEmojiEntity) return;
  if (folderId) {
    window?.localStorage.setItem(
      `tt-chatfolder-${folderId}-custom-emoji-entity`, JSON.stringify(customEmojiEntity),
    );
  } else {
    window?.localStorage.setItem(
      `tt-chatfolder-${folder.title.text}-custom-emoji-entity`, JSON.stringify(customEmojiEntity),
    );
  }
}

/**
 * Checks if there is a custom emoji in localStorage -
 * workaround for unexisting telegram persistense for folder' custom emojis as icons
 */
function getPersistentChatFolderCustomEmojiEntity(
  folder: Pick<ApiChatFolder, 'title'>,
  leadingEmoji: string,
  folderId?: ApiChatFolder['id'],
): ApiMessageEntityCustomEmoji | undefined {
  let localStorageEntry: string | null | undefined;
  let shouldMove = false;
  if (folderId) {
    localStorageEntry = window?.localStorage.getItem(`tt-chatfolder-${folderId}-custom-emoji-entity`);
  }

  if (!localStorageEntry) {
    localStorageEntry = window?.localStorage.getItem(`tt-chatfolder-${folder.title.text}-custom-emoji-entity`);
    shouldMove = Boolean(folderId);
  }

  const parsedLocalStorageEntry = localStorageEntry ? JSON.parse(localStorageEntry) : undefined;
  if (
    localStorageEntry && parsedLocalStorageEntry
      && parsedLocalStorageEntry.type === ApiMessageEntityTypes.CustomEmoji
      && parsedLocalStorageEntry.offset === 0
      && parsedLocalStorageEntry.length === leadingEmoji.length
      && parsedLocalStorageEntry.documentId
  ) {
    if (shouldMove) {
      // move from title text - based key to folder id key asap
      window.localStorage.removeItem(`tt-chatfolder-${folder.title.text}-custom-emoji-entity`);
      window.localStorage.setItem(`tt-chatfolder-${folderId}-custom-emoji-entity`, localStorageEntry);
    }
    return parsedLocalStorageEntry;
  }

  return undefined;
}

export function removePersistentChatFolderCustomEmojiEntity(
  folder: Pick<ApiChatFolder, 'title'>,
  folderId?: ApiChatFolder['id'],
): void {
  window?.localStorage.removeItem(`tt-chatfolder-${folder.title.text}-custom-emoji-entity`);
  if (folderId) {
    window?.localStorage.removeItem(`tt-chatfolder-${folderId}-custom-emoji-entity`);
  }
}

/**
 * Get chat folder emoji if there is one. Does not return emoji from 'emoticon' field
 * to make folder being able to have an SVG icon instead - which will get mapped from that 'emoticon' field with
 * EMOTICONS_TO_ICON_NAME_MAP
 */
export function getChatFolderEmojiText(
  folder: Pick<ApiChatFolder, 'title' | 'emoticon'>,
  folderId?: ApiChatFolder['id'],
  useLocalStorage: boolean = true,
): ApiFormattedText | undefined {
  const leadingEmoji = getLeadingEmoji(folder.title.text);
  if (!leadingEmoji) {
    // find the first if there is one
    // const firstEmoji = getFirstEmoji(folder.title.text);
    // return firstEmoji ? { text: firstEmoji, entities: [] } : undefined;
    return undefined;
  }

  for (const entity of folder.title.entities || []) {
    if (entity.type === ApiMessageEntityTypes.CustomEmoji && entity.offset === 0) {
      // return the custom emoji if found one in title entities
      return { text: leadingEmoji, entities: [entity] };
    }
  }

  if (!useLocalStorage) {
    return { text: leadingEmoji, entities: [] };
  }

  const localStorageEntity = getPersistentChatFolderCustomEmojiEntity(folder, leadingEmoji, folderId);

  return { text: leadingEmoji, entities: localStorageEntity ? [localStorageEntity] : [] };
}

/** Puts an emoji into 'emoticon' field with splicing it into the title */
export function patchChatFolderWithEmoji(
  folder: Pick<ApiChatFolder, 'title'>,
  emoji: string | undefined,
  customEmojiId?: string,
): Partial<ApiChatFolder> {
  if (!emoji) {
    const leadingEmoji = getLeadingEmoji(folder.title.text);
    return {
      ...folder,
      emoticon: '',
      title: { text: folder.title.text.slice(leadingEmoji?.length ?? 0), entities: folder.title.entities },
    };
  } else if (customEmojiId) {
    const newTitle = spliceEmoticonIntoChatFolderTitle(folder.title, emoji ?? '', customEmojiId);
    return {
      ...folder,
      emoticon: API_ACCEPTED_EMOTICONS_LIST.includes(emoji ?? '') ? emoji : '',
      title: newTitle,
    };
  } else {
    const newTitle = spliceEmoticonIntoChatFolderTitle(folder.title, emoji);
    return {
      ...folder,
      emoticon: API_ACCEPTED_EMOTICONS_LIST.includes(emoji) ? emoji : '',
      title: newTitle,
    };
  }
}

/** Puts an emoji into 'emoticon' field without splicing it into the title, removes any emoticon that is present in title.text or title.entities */
export function patchChatFolderWithSvgIcon(
  folder: Pick<ApiChatFolder, 'title'>,
  icon: IconName,
): Partial<ApiChatFolder> {
  if (!ICON_NAME_TO_EMOTICON_MAP[icon]) {
    return folder; // could throw an error? do nothing
  }

  const leadingEmoji = getLeadingEmoji(folder.title.text);

  return {
    ...folder,
    emoticon: ICON_NAME_TO_EMOTICON_MAP[icon],
    title: {
      text: folder.title.text.slice(leadingEmoji?.length ?? 0),
      entities: folder.title.entities?.filter((entity) => !(
        entity.type === ApiMessageEntityTypes.CustomEmoji
        && entity.offset === 0
      )),
    },
  };
}

/** Returns folder title without leading emoji to render on screen */
export function getChatFolderTitle(
  folder: Pick<ApiChatFolder, 'title'>,
): ApiFormattedText {
  const leadingEmoji = getLeadingEmoji(folder.title.text);
  if (leadingEmoji) {
    return {
      text: folder.title.text.slice(leadingEmoji.length),
      entities: folder.title.entities?.filter((entity) => !(
        entity.type === ApiMessageEntityTypes.CustomEmoji
        && entity.offset === 0
      )),
    };
  }
  return folder.title;
}

/** Gives new title text, preserves the leading emoji in case it is present */
export function putChatFolderTitleText(
  newTitleText: string,
  title: ApiFormattedText,
): string {
  const leadingEmoji = getLeadingEmoji(title.text);
  if (leadingEmoji) {
    return `${leadingEmoji}${newTitleText}`;
  }
  return newTitleText;
}
