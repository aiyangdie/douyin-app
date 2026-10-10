import type { Conversation } from './types';

/** Rows for the 消息 tab. */
export const CONVERSATIONS: Conversation[] = [
  {
    id: 'n1',
    creatorId: 'u4',
    lastMessage: '谢谢你喜欢我家猫！它今天又胖了 0.2 斤',
    timeLabel: '刚刚',
    unread: 2,
    context: '回复了你的评论',
  },
  {
    id: 'n2',
    creatorId: 'u1',
    lastMessage: '天台的位置发你了，记得带三脚架',
    timeLabel: '12分钟前',
    unread: 1,
  },
  {
    id: 'n3',
    creatorId: 'u2',
    lastMessage: '[视频] 海边日落 · 完整版',
    timeLabel: '1小时前',
    unread: 0,
    context: '分享了视频',
  },
  {
    id: 'n4',
    creatorId: 'u7',
    lastMessage: '那家面馆我再去一次，要不要一起',
    timeLabel: '3小时前',
    unread: 4,
  },
  {
    id: 'n5',
    creatorId: 'u5',
    lastMessage: '训练计划发你了，先练两周看看',
    timeLabel: '昨天',
    unread: 0,
  },
  {
    id: 'n6',
    creatorId: 'u8',
    lastMessage: '大理的客栈我住的那家，很安静，推荐',
    timeLabel: '昨天',
    unread: 0,
  },
  {
    id: 'n7',
    creatorId: 'u6',
    lastMessage: '这个 bug 我复现了，是缓存没清',
    timeLabel: '星期二',
    unread: 0,
  },
  {
    id: 'n8',
    creatorId: 'u3',
    lastMessage: '豆子给你留了一包，浅烘的',
    timeLabel: '上周',
    unread: 0,
  },
];

/** The quick-entry row pinned above the conversation list. */
export const INBOX_SHORTCUTS = [
  { id: 's1', label: '新粉丝', icon: 'person-add-outline', badge: 12, tint: '#FE2C55' },
  { id: 's2', label: '赞', icon: 'heart-outline', badge: 128, tint: '#FF7A45' },
  { id: 's3', label: '@我的', icon: 'at-outline', badge: 3, tint: '#25F4EE' },
  { id: 's4', label: '评论', icon: 'chatbubble-ellipses-outline', badge: 46, tint: '#7C5CFF' },
] as const;
