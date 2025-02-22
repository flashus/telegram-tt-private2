import React from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';
import { type ApiFormattedText, ApiMessageEntityTypes } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import { renderTextWithEntities } from '../../common/helpers/renderTextWithEntities';

import CustomEmoji from '../../common/CustomEmoji';
import Icon from '../../common/icons/Icon';

import './ChatFolderIcon.scss';

type OwnProps = {
  iconEmojiText?: ApiFormattedText;
  iconName: IconName;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

const ChatFolderIcon = ({
  iconEmojiText,
  iconName,
  className,
  onClick,
}: OwnProps) => {
  return (
    <div className={buildClassName('ChatFolderIcon', className)} onClick={onClick}>
      {iconEmojiText
        && (iconEmojiText.entities?.length ?? 0) > 0
        && iconEmojiText.entities?.[0].type === ApiMessageEntityTypes.CustomEmoji
        && (
          <CustomEmoji
            documentId={iconEmojiText.entities![0].documentId}
            size={32}
          />
        )}
      {iconEmojiText && iconEmojiText?.entities?.length === 0 && renderTextWithEntities({
        text: iconEmojiText.text,
        entities: iconEmojiText.entities,
      })}
      {!iconEmojiText && <Icon name={iconName} />}
    </div>
  );
};

export default ChatFolderIcon;
