import type { FC } from '../../../lib/teact/teact';
import React from '../../../lib/teact/teact';

import type { OwnProps } from './PreviewMessageListModal';

import { Bundles } from '../../../util/moduleLoader';

import useModuleLoader from '../../../hooks/useModuleLoader';

const PreviewMessageListModalAsync: FC<OwnProps> = (props) => {
  const { modal } = props;
  const PreviewMessageListModal = useModuleLoader(Bundles.Extra, 'PreviewMessageListModal', !modal);

  // eslint-disable-next-line react/jsx-props-no-spreading
  return PreviewMessageListModal ? <PreviewMessageListModal {...props} /> : undefined;
};

export default PreviewMessageListModalAsync;
