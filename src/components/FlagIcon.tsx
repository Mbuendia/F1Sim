import React, { useState, useEffect } from 'react';

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
  'united kingdom': 'gb',
  'países bajos': 'nl',
  'netherlands': 'nl',
  'holanda': 'nl',
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
  'ee.uu.': 'us',
  'eeuu': 'us',
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
  'emiratos árabes': 'ae',
  'uae': 'ae',
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
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [country, emoji]);

  let iso = '';
  if (emoji && EMOJI_TO_ISO[emoji]) {
    iso = EMOJI_TO_ISO[emoji];
  } else if (country) {
    const clean = country.toLowerCase().trim();
    if (COUNTRY_TO_ISO[clean]) {
      iso = COUNTRY_TO_ISO[clean];
    }
  }

  if (!iso || imgError) {
    return (
      <span 
        className={className} 
        style={{ 
          fontSize: `${size}px`, 
          lineHeight: 1, 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          ...style 
        }}
      >
        {emoji || '🏁'}
      </span>
    );
  }

  const base = import.meta.env.BASE_URL || '/';
  const cleanBase = base.endsWith('/') ? base : `${base}/`;
  const flagUrl = `${cleanBase}flags/${iso.toLowerCase()}.svg`;

  return (
    <img
      src={flagUrl}
      alt={country || emoji || 'flag'}
      className={className}
      style={{
        width: `${size * 1.35}px`,
        height: `${size}px`,
        objectFit: 'cover',
        borderRadius: '2px',
        display: 'inline-block',
        verticalAlign: 'middle',
        boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        ...style
      }}
      onError={() => setImgError(true)}
    />
  );
};
