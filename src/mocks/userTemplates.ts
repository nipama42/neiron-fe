import type { UserPublishedTemplate } from '../types'

/** Моки: только фото/видео, далее сортируем по лайкам на странице */
export const USER_TEMPLATES_RAW: UserPublishedTemplate[] = [
  {
    id: 101,
    type: 'photo',
    title: 'Неоновый город после дождя',
    authorUsername: 'mara_studio',
    likes: 2840,
    coverGradient: 'from-slate-700 via-teal-900 to-slate-900',
  },
  {
    id: 102,
    type: 'video',
    title: 'Плавный зум к горизонту',
    authorUsername: 'kino_cut',
    likes: 1922,
    coverGradient: 'from-emerald-900 via-slate-800 to-zinc-950',
  },
  {
    id: 103,
    type: 'photo',
    title: 'Портрет в мягком свете',
    authorUsername: 'light_box',
    likes: 1655,
    coverGradient: 'from-stone-600 via-slate-700 to-neutral-900',
  },
  {
    id: 104,
    type: 'video',
    title: 'Луп танца — 12 сек',
    authorUsername: 'motion_lab',
    likes: 1403,
    coverGradient: 'from-cyan-950 via-slate-800 to-slate-950',
  },
  {
    id: 105,
    type: 'photo',
    title: 'Минималистичный натюрморт',
    authorUsername: 'quiet_frame',
    likes: 987,
    coverGradient: 'from-zinc-600 via-stone-800 to-neutral-950',
  },
  {
    id: 106,
    type: 'video',
    title: 'Таймлапс облаков',
    authorUsername: 'sky_log',
    likes: 756,
    coverGradient: 'from-slate-600 via-teal-950 to-slate-950',
  },
  {
    id: 107,
    type: 'photo',
    title: 'Архитектура: линии и стекло',
    authorUsername: 'urban_lines',
    likes: 612,
    coverGradient: 'from-neutral-700 via-slate-800 to-zinc-950',
  },
  {
    id: 108,
    type: 'video',
    title: 'Тизер продукта — чистый стиль',
    authorUsername: 'brand_pulse',
    likes: 445,
    coverGradient: 'from-emerald-950 via-slate-900 to-neutral-950',
  },
]
