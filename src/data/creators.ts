import type { Creator } from './types';

/**
 * Local fixture accounts. Avatars are generated PNGs shipped in
 * `assets/avatars`, so the app renders identically offline.
 */
export const CREATORS: Creator[] = [
  {
    id: 'u1',
    name: '夜行者Leo',
    handle: 'leo_nightwalk',
    avatar: require('../../assets/avatars/u1.png'),
    bio: '城市夜景摄影｜走了 37 个城市的天台',
    verified: true,
    stats: { following: 312, followers: 1_284_000, likes: 18_920_000 },
  },
  {
    id: 'u2',
    name: '旅行的鱼',
    handle: 'fish_travel',
    avatar: require('../../assets/avatars/u2.png'),
    bio: '在海边住了一整年 🐟 日落收集者',
    verified: true,
    stats: { following: 208, followers: 862_000, likes: 9_140_000 },
  },
  {
    id: 'u3',
    name: '慢生活研究所',
    handle: 'slowlab',
    avatar: require('../../assets/avatars/u3.png'),
    bio: '一杯咖啡的时间，聊聊怎么把日子过慢',
    verified: false,
    stats: { following: 421, followers: 396_000, likes: 4_530_000 },
  },
  {
    id: 'u4',
    name: '橘猫日记',
    handle: 'orange_cat_diary',
    avatar: require('../../assets/avatars/u4.png'),
    bio: '家里有两只橘，一只胖，另一只更胖',
    verified: false,
    stats: { following: 96, followers: 2_310_000, likes: 41_600_000 },
  },
  {
    id: 'u5',
    name: '铁馆阿哲',
    handle: 'iron_zhe',
    avatar: require('../../assets/avatars/u5.png'),
    bio: '健身教练｜带 8000 人减掉第一斤',
    verified: true,
    stats: { following: 154, followers: 674_000, likes: 7_820_000 },
  },
  {
    id: 'u6',
    name: '深夜提交',
    handle: 'midnight_commit',
    avatar: require('../../assets/avatars/u6.png'),
    bio: '写了 12 年代码，还在改 bug',
    verified: false,
    stats: { following: 63, followers: 528_000, likes: 6_070_000 },
  },
  {
    id: 'u7',
    name: '干饭人小鹿',
    handle: 'deer_eats',
    avatar: require('../../assets/avatars/u7.png'),
    bio: '探店 600 家｜只推荐自己会再去的',
    verified: true,
    stats: { following: 507, followers: 1_960_000, likes: 28_400_000 },
  },
  {
    id: 'u8',
    name: '背包客阿May',
    handle: 'may_onroad',
    avatar: require('../../assets/avatars/u8.png'),
    bio: '一个人走了 23 个国家｜路上见',
    verified: false,
    stats: { following: 289, followers: 443_000, likes: 5_260_000 },
  },
];

/** The signed-in account shown on the 我 tab. */
export const CURRENT_USER: Creator = {
  id: 'me',
  name: '小怂猪',
  handle: 'xiaosongzhu',
  avatar: require('../../assets/avatars/me.png'),
  bio: '记录一下，随便拍拍 📷',
  verified: false,
  stats: { following: 128, followers: 2_431, likes: 18_602 },
};

const BY_ID = new Map<string, Creator>(
  [...CREATORS, CURRENT_USER].map((creator) => [creator.id, creator]),
);

/** Look up an account, falling back to the signed-in user. */
export function getCreator(id: string): Creator {
  return BY_ID.get(id) ?? CURRENT_USER;
}
