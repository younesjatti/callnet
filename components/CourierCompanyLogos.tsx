import React from 'react';
import { OZON_EXPRESS_LOGO, DIGYLOG_LOGO } from '../lib/courierCities';

interface LogoProps {
  className?: string;
  size?: number;
}

/**
 * IRSALIYAT Logo:
 * Matches the photo: Teal pin icon with top orange circle and upward route arrow
 */
export const IrsaliyatLogo: React.FC<LogoProps> = ({ className = 'w-16 h-16', size = 64 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xs">
        {/* Map pin base in teal */}
        <path
          d="M50 14 C34 14 22 26 22 42 C22 62 48 86 50 88 C52 86 78 62 78 42 C78 26 66 14 50 14 Z"
          fill="#0d9488"
        />
        {/* Inner white cutout circle */}
        <circle cx="50" cy="40" r="16" fill="#ffffff" />
        {/* Teal navigation arrow pointing top-left */}
        <path
          d="M50 28 L37 49 L48 46 L53 53 L58 45 L50 28 Z"
          fill="#0f766e"
        />
        {/* Top accent orange dot */}
        <circle cx="50" cy="11" r="7" fill="#f97316" />
      </svg>
    </div>
  );
};

/**
 * ONESSTA Logo:
 * Matches the photo: Royal blue rounded square with bright neon lime green & yellow accent leaf / 'A'
 */
export const OnesstaLogo: React.FC<LogoProps> = ({ className = 'w-16 h-16', size = 64 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full rounded-2xl shadow-xs overflow-hidden">
        {/* Vibrant blue rounded background */}
        <rect width="100" height="100" rx="22" fill="#0037ff" />
        {/* Stylized ribbon/sprout in neon green */}
        <path
          d="M26 68 C28 50 42 32 58 28 C56 42 46 54 36 60 Z"
          fill="#84cc16"
        />
        <path
          d="M58 28 C64 36 74 52 74 68 C62 66 50 56 46 48 Z"
          fill="#a3e635"
        />
        {/* Center fold accent in vibrant yellow */}
        <circle cx="50" cy="50" r="8" fill="#fde047" />
      </svg>
    </div>
  );
};

/**
 * FORCELOG Logo:
 * Matches the photo: Warm yellow rounded square with black "F FORCELOG" branding
 */
export const ForcelogLogo: React.FC<LogoProps> = ({ className = 'w-16 h-16', size = 64 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full rounded-2xl shadow-xs overflow-hidden">
        {/* Yellow rounded square */}
        <rect width="100" height="100" rx="22" fill="#facc15" />
        {/* Stylized dynamic F */}
        <path
          d="M22 36 L44 36 L41 43 L32 43 L30 49 L39 49 L36 55 L27 55 L22 68 L15 68 L22 36 Z"
          fill="#000000"
        />
        {/* Bold black FORCELOG text */}
        <text
          x="44"
          y="56"
          fill="#000000"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="10"
          letterSpacing="0.5"
        >
          FORCELOG
        </text>
      </svg>
    </div>
  );
};

/**
 * AMEEX Logo:
 * Matches the photo: White background with crossed navy blue & orange arrows forming 'X' and 'ameex nothing stops us'
 */
export const AmeexLogo: React.FC<LogoProps> = ({ className = 'w-16 h-16', size = 64 }) => {
  return (
    <div className={`relative flex items-center justify-center bg-white rounded-2xl p-1 shadow-xs border border-slate-100 ${className}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Blue Arrow pointing top-right */}
        <path
          d="M32 64 L62 34 M62 34 L48 34 M62 34 L62 48"
          stroke="#1e3a8a"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Orange Arrow pointing top-left / crossed */}
        <path
          d="M68 64 L38 34 M38 34 L52 34 M38 34 L38 48"
          stroke="#ea580c"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Ameex typography */}
        <text
          x="50"
          y="78"
          textAnchor="middle"
          fill="#1e293b"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="13"
          letterSpacing="-0.5"
        >
          ameex
        </text>
        <text
          x="50"
          y="88"
          textAnchor="middle"
          fill="#94a3b8"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="600"
          fontSize="5"
        >
          nothing stops us
        </text>
      </svg>
    </div>
  );
};

/**
 * CATHEDIS Logo:
 * Matches the photo: White background with red emblem and CATHEDIS uppercase label
 */
export const CathedisLogo: React.FC<LogoProps> = ({ className = 'w-16 h-16', size = 64 }) => {
  return (
    <div className={`relative flex items-center justify-center bg-white rounded-2xl p-1 shadow-xs border border-slate-100 ${className}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Red geometric speed wing / chevron */}
        <path
          d="M26 38 L68 28 L62 52 L20 62 Z"
          fill="#dc2626"
        />
        <path
          d="M36 44 L78 36 L74 54 L32 62 Z"
          fill="#991b1b"
          opacity="0.5"
        />
        {/* Inner white dynamic slash */}
        <path
          d="M48 35 L42 55"
          stroke="#ffffff"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* CATHEDIS text */}
        <text
          x="50"
          y="78"
          textAnchor="middle"
          fill="#0f172a"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="11"
          letterSpacing="0.8"
        >
          CATHEDIS
        </text>
      </svg>
    </div>
  );
};

/**
 * CHRONO DIALI Logo:
 * Matches the photo: Vibrant cyan/azure blue 3D isometric delivery cube
 */
export const ChronoDialiLogo: React.FC<LogoProps> = ({ className = 'w-16 h-16', size = 64 }) => {
  return (
    <div className={`relative flex items-center justify-center bg-white rounded-2xl p-1 shadow-xs border border-slate-100 ${className}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Isometric 3D Cyan Cube */}
        {/* Top Face */}
        <polygon points="50,18 78,34 50,50 22,34" fill="#38bdf8" />
        {/* Left Face */}
        <polygon points="22,34 50,50 50,82 22,66" fill="#0284c7" />
        {/* Right Face */}
        <polygon points="50,50 78,34 78,66 50,82" fill="#0369a1" />
        {/* Cutout/slit accents */}
        <line x1="50" y1="50" x2="50" y2="82" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="50" x2="78" y2="34" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="50" x2="22" y2="34" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
};

/**
 * SENDIT Logo:
 * Matches the photo: White background with navy package icon and green arrow + Sendit font
 */
export const SenditLogo: React.FC<LogoProps> = ({ className = 'w-16 h-16', size = 64 }) => {
  return (
    <div className={`relative flex items-center justify-center bg-white rounded-2xl p-1 shadow-xs border border-slate-100 ${className}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Stylized shopping bag / box */}
        <path
          d="M32 36 L68 36 L74 68 L26 68 Z"
          fill="#1e3a8a"
        />
        {/* Handle */}
        <path
          d="M40 36 C40 28 60 28 60 36"
          stroke="#1e3a8a"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
        {/* Lime green delivery fold / checkmark */}
        <path
          d="M42 52 L48 58 L60 44"
          stroke="#84cc16"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* SendIt text */}
        <text
          x="50"
          y="84"
          textAnchor="middle"
          fill="#1e3a8a"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="11"
        >
          Send<tspan fill="#84cc16">it</tspan>
        </text>
      </svg>
    </div>
  );
};

/**
 * OZON EXPRESS Logo:
 * Matches the photo: Golden yellow rounded square with red winged parcel
 */
export const OzonExpressLogo: React.FC<LogoProps> = ({ className = 'w-16 h-16', size = 64 }) => {
  return (
    <div className={`relative flex items-center justify-center rounded-2xl overflow-hidden shadow-xs ${className}`}>
      <img
        src={OZON_EXPRESS_LOGO}
        alt="Ozon Express"
        className="w-full h-full object-contain bg-amber-400 p-1 rounded-2xl"
        referrerPolicy="no-referrer"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    </div>
  );
};

/**
 * DIGYLOG Logo:
 * Official Digylog vector asset
 */
export const DigylogLogo: React.FC<LogoProps> = ({ className = 'w-16 h-16', size = 64 }) => {
  return (
    <div className={`relative flex items-center justify-center bg-white rounded-2xl p-2 shadow-xs border border-slate-100 ${className}`}>
      <img
        src={DIGYLOG_LOGO}
        alt="DIGYLOG"
        className="w-full h-full object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};

/**
 * KARGO EXPRESS Logo:
 * Deep blue badge with package / KG
 */
export const KargoExpressLogo: React.FC<LogoProps> = ({ className = 'w-16 h-16', size = 64 }) => {
  return (
    <div className={`relative flex items-center justify-center rounded-2xl overflow-hidden shadow-xs bg-blue-600 text-white font-extrabold ${className}`}>
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-2">
        <rect width="100" height="100" rx="20" fill="#2563eb" />
        <path d="M50 20 L80 35 L50 50 L20 35 Z" fill="#93c5fd" />
        <path d="M20 35 L50 50 L50 80 L20 65 Z" fill="#1d4ed8" />
        <path d="M50 50 L80 35 L80 65 L50 80 Z" fill="#1e40af" />
        <text
          x="50"
          y="56"
          textAnchor="middle"
          fill="#ffffff"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="900"
          fontSize="14"
        >
          KG
        </text>
      </svg>
    </div>
  );
};
