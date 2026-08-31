import React from 'react';

const EMOJI_TO_ISO: Record<string, string> = {
  '🇳🇱': 'nl',
  '🇳🇿': 'nz',
  '🇬🇧': 'gb',
  '🇦🇺': 'au',
  '🇲🇨': 'mc',
  '🇪🇸': 'es',
  '🇩🇪': 'de',
  '🇮🇹': 'it',
  '🇫🇷': 'fr',
  '🇲🇽': 'mx',
  '🇨🇦': 'ca',
  '🇯🇵': 'jp',
  '🇦🇷': 'ar',
  '🇹🇭': 'th',
  '🇩🇰': 'dk',
  '🇫🇮': 'fi',
  '🇺🇸': 'us',
  '🇧🇷': 'br',
  '🇨🇳': 'cn',
  '🇧🇭': 'bh',
  '🇸🇦': 'sa',
  '🇦🇪': 'ae',
  '🇶🇦': 'qa',
  '🇦🇿': 'az',
  '🇸🇬': 'sg',
  '🇭🇺': 'hu',
  '🇧🇪': 'be',
  '🇦🇹': 'at',
};

const COUNTRY_TO_ISO: Record<string, string> = {
  'españa': 'es',
  'spain': 'es',
  'reino unido': 'gb',
  'great britain': 'gb',
  'países bajos': 'nl',
  'netherlands': 'nl',
  'mónaco': 'mc',
  'monaco': 'mc',
  'méxico': 'mx',
  'mexico': 'mx',
  'australia': 'au',
  'italia': 'it',
  'italy': 'it',
  'francia': 'fr',
  'france': 'fr',
  'alemania': 'de',
  'germany': 'de',
  'canadá': 'ca',
  'canada': 'ca',
  'japón': 'jp',
  'japan': 'jp',
  'argentina': 'ar',
  'nueva zelanda': 'nz',
  'new zealand': 'nz',
  'estados unidos': 'us',
  'usa': 'us',
  'brasil': 'br',
  'brazil': 'br',
  'china': 'cn',
  'baréin': 'bh',
  'bahrain': 'bh',
  'arabia saudí': 'sa',
  'saudi arabia': 'sa',
  'azerbaiyán': 'az',
  'azerbaijan': 'az',
  'singapur': 'sg',
  'singapore': 'sg',
  'hungría': 'hu',
  'hungary': 'hu',
  'bélgica': 'be',
  'belgium': 'be',
  'austria': 'at',
  'emiratos árabes unidos': 'ae',
  'qatar': 'qa',
  'catar': 'qa'
};

export interface FlagIconProps {
  country?: string;
  emoji?: string;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
}

export const FlagIcon: React.FC<FlagIconProps> = ({
  country,
  emoji,
  className,
  style,
  size = 14
}) => {
  let iso = '';
  if (emoji && EMOJI_TO_ISO[emoji]) {
    iso = EMOJI_TO_ISO[emoji];
  } else if (country && COUNTRY_TO_ISO[country.toLowerCase().trim()]) {
    iso = COUNTRY_TO_ISO[country.toLowerCase().trim()];
  }

  if (!iso) {
    return <span style={style} className={className}>{emoji || '🏁'}</span>;
  }

  return (
    <img
      src={`/flags/${iso}.svg`}
      alt={country || emoji || 'flag'}
      className={className}
      style={{
        width: `${size * 1.35}px`,
        height: `${size}px`,
        objectFit: 'cover',
        borderRadius: '2px',
        display: 'inline-block',
        verticalAlign: 'middle',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        ...style
      }}
      onError={(e) => {
        (e.currentTarget as HTMLElement).style.display = 'none';
      }}
    />
  );
};
