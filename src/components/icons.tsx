interface IconProps {
  className?: string;
  size?: number;
}

const ic = (path: string, viewBox = '0 0 24 24') =>
  ({ className = 'w-5 h-5', size }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      width={size}
      height={size}
    >
      {path.split('|').map((d, i) => <path key={i} d={d} />)}
    </svg>
  );

export const HomeIcon = ic('M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z|M9 22V12h6v10');
export const TargetIcon = ic('M12 22a10 10 0 100-20 10 10 0 000 20z|M12 18a6 6 0 100-12 6 6 0 000 12z|M12 14a2 2 0 100-4 2 2 0 000 4z');
export const TrendingUpIcon = ic('M23 6l-9.5 9.5-5-5L1 18|M17 6h6v6');
export const TrophyIcon = ic('M6 9H3.5a2.5 2.5 0 000 5H6|M18 9h2.5a2.5 2.5 0 010 5H18|M6 9V3h12v6|M6 14a6 6 0 0012 0V9H6v5z|M9 22h6|M12 18v4');
export const UsersIcon = ic('M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2|M9 11a4 4 0 100-8 4 4 0 000 8z|M23 21v-2a4 4 0 00-3-3.87|M16 3.13a4 4 0 010 7.75');
export const FileTextIcon = ic('M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z|M14 2v6h6|M16 13H8|M16 17H8|M10 9H8');
export const DocumentTextIcon = FileTextIcon;
export const MessageSquareIcon = ic('M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z');
export const BellIcon = ic('M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 01-3.46 0');
export const HelpCircleIcon = ic('M12 22a10 10 0 100-20 10 10 0 000 20z|M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3|M12 17h.01');
export const CopyIcon = ic('M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z|M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1');
export const ChevronDownIcon = ic('M6 9l6 6 6-6');
export const ChevronRightIcon = ic('M9 18l6-6-6-6');
export const LockIcon = ic('M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z|M7 11V7a5 5 0 0110 0v4');
export const UnlockIcon = ic('M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z|M7 11V7a5 5 0 019.9-1');
export const CheckIcon = ic('M20 6L9 17l-5-5');
export const CheckCircleIcon = ic('M22 11.08V12a10 10 0 11-5.93-9.14|M22 4L12 14.01l-3-3');
export const XIcon = ic('M18 6L6 18|M6 6l12 12');
export const XCircleIcon = ic('M12 22a10 10 0 100-20 10 10 0 000 20z|M15 9l-6 6|M9 9l6 6');
export const AlertTriangleIcon = ic('M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z|M12 9v4|M12 17h.01');
export const ClockIcon = ic('M12 22a10 10 0 100-20 10 10 0 000 20z|M12 6v6l4 2');
export const ZapIcon = ic('M13 2L3 14h9l-1 8 10-12h-9l1-8z');
export const LightbulbIcon = ic('M9 18h6|M10 22h4|M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z');
export const ArrowRightIcon = ic('M5 12h14|M12 5l7 7-7 7');
export const ArrowLeftIcon = ic('M19 12H5|M12 19l-7-7 7-7');
export const GripVerticalIcon = ic('M4 9h16|M4 12h16|M4 15h16');
export const SendIcon = ic('M22 2L11 13|M22 2L15 22l-4-9-9-4 20-7z');
export const PlayIcon = ic('M5 3l14 9-14 9V3z');
export const RefreshIcon = ic('M23 4v6h-6|M1 20v-6h6|M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15');
export const DownloadIcon = ic('M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4|M7 10l5 5 5-5|M12 15V3');
export const ExpandIcon = ic('M15 3h6v6|M9 21H3v-6|M21 3l-7 7|M3 21l7-7');
export const EyeIcon = ic('M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z|M12 15a3 3 0 100-6 3 3 0 000 6z');
export const ShieldIcon = ic('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z');
export const BrainIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M12 5a3 3 0 10-5.997.125 4 4 0 00-2.526 5.77 4 4 0 00.556 6.588A4 4 0 1012 18z" />
    <path d="M12 5a3 3 0 115.997.125 4 4 0 012.526 5.77 4 4 0 01-.556 6.588A4 4 0 1112 18z" />
    <path d="M15 13a4.5 4.5 0 01-3-4 4.5 4.5 0 01-3 4" />
    <path d="M17.599 6.5a3 3 0 00.399-1.375" />
    <path d="M6.003 5.125A3 3 0 006.401 6.5" />
    <path d="M3.477 10.896a4 4 0 01.585-.396" />
    <path d="M19.938 10.5a4 4 0 01.585.396" />
    <path d="M6 18a4 4 0 01-1.967-.516" />
    <path d="M19.967 17.484A4 4 0 0118 18" />
  </svg>
);
export const PuzzleIcon = ic('M20.59 13H16a2 2 0 00-2 2v4.59a2 2 0 001 1.73l4 2.31a2 2 0 002 0l4-2.31a2 2 0 001-1.73V15a2 2 0 00-2-2h-3.41zM2 6v4a2 2 0 002 2h4V6a2 2 0 00-2-2H4a2 2 0 00-2 2z');
export const SwordsIcon = ic('M14.5 17.5L3 6V3h3l11.5 11.5|M13 19l6-6|M2 2l20 20|M20 2l-5 5|M18 7l4-4');
export const CrownIcon = ic('M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z|M5 20h14');
export const CodeIcon = ic('M16 18l6-6-6-6|M8 6l-6 6 6 6');
export const DatabaseIcon = ic('M12 2C6.48 2 2 4.24 2 7s4.48 5 10 5 10-2.24 10-5-4.48-5-10-5z|M2 7v5c0 2.76 4.48 5 10 5s10-2.24 10-5V7|M2 12v5c0 2.76 4.48 5 10 5s10-2.24 10-5v-5');
export const WifiOffIcon = ic('M1 1l22 22|M16.72 11.06A10.94 10.94 0 0119 12.55|M5 12.55a10.94 10.94 0 0115.11-2.45|M10.71 5.05A16 16 0 0122.56 9|M1.42 9a16 16 0 014.7-2.88|M8.53 16.11a6 6 0 016.95 0|M12 20h.01');
export const WifiIcon = ic('M5 12.55a11 11 0 0114.08 0|M1.42 9a16 16 0 0121.16 0|M8.53 16.11a6 6 0 016.95 0|M12 20h.01');
export const BookIcon = ic('M4 19.5A2.5 2.5 0 016.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z');
export const StarIcon = ic('M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
export const FlaskIcon = ic('M9 3h6|M10 3v4.5L6 13v5a2 2 0 002 2h8a2 2 0 002-2v-5l-4-5.5V3');
export const TerminalIcon = ic('M4 17l6-6-6-6|M12 19h8');
export const MaximizeIcon = ic('M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3');
export const PencilIcon = ic('M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z');
export const PlusIcon = ic('M12 5v14|M5 12h14');
export const TrashIcon = ic('M9 3H7a2 2 0 00-2 2v1h14V5a2 2 0 00-2-2h-2m0 0H9m0 0a1 1 0 00-1 1v1H4v2h16V7a1 1 0 00-1-1H9zm0 11v-8m0 8a2 2 0 002 2h8a2 2 0 002-2v-8H9v8z');
export const BanIcon = ic('M12 22a10 10 0 100-20 10 10 0 000 20z|M5 12a7 7 0 0114 0');
export const SearchIcon = ic('M11 19a8 8 0 100-16 8 8 0 000 16z|M21 21l-4.35-4.35');
export const KeyIcon = ic('M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4');
export const CircleIcon = ic('M12 22a10 10 0 100-20 10 10 0 000 20z');
export const ExclamationCircleIcon = ic('M12 22a10 10 0 100-20 10 10 0 000 20z|M12 8v4|M12 16h.01');
export const VolumeIcon = ic('M11 5L6 9H2v6h4l5 4V5z|M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07');
export const VolumeXIcon = ic('M11 5L6 9H2v6h4l5 4V5z|M23 9l-6 6|M17 9l6 6');
export const SparklesIcon = ic('M12 3l1.912 5.885L20 10.8l-4.756 3.456L17.09 20.1 12 16.395 6.91 20.1l1.846-5.844L4 10.8l6.088-1.915L12 3z');


