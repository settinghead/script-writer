import React, { useState, useEffect } from 'react';
import {
    Modal,
    Drawer,
    Button,
    Checkbox,
    Typography,
    Row,
    Col,
    Menu,
    List,
    Form,
    Space,
    Card,
    Breadcrumb,
    Flex,
    Tag,
    Alert
} from 'antd';
import { RightOutlined, LeftOutlined, CloseOutlined, HomeOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Text, Title } = Typography;

// Configuration constants
const MAX_GENRE_SELECTIONS = 4;
const COLUMN_WIDTH = 200;
const COLUMN_GAP = 8;
const MAX_COLUMNS = 3;
const MODAL_PADDING = 48; // Modal internal padding
const MODAL_WIDTH = MAX_COLUMNS * COLUMN_WIDTH + (MAX_COLUMNS - 1) * COLUMN_GAP + MODAL_PADDING;
const COLUMN_HEIGHT = 300;
const SELECTED_ITEMS_HEIGHT = 120; // Reserved space for selected items section
const MODAL_HEIGHT = COLUMN_HEIGHT + SELECTED_ITEMS_HEIGHT + 100; // Extra space for padding

// Genre hierarchy with disabled states
export const genreOptions = {
    '人物设定': {
        '女性角色': {
            '女性成长': ['女性觉醒', '独立自强', '事业女性', '全职妈妈', '单身贵族', '女强人', '知识女性', '艺术女性', '运动女性', '创业女性', '公益女性', '科技女性'],
            '女性复仇': ['复仇女神', '反转打脸', '以牙还牙', '绝地反击', '冷酷复仇', '智慧复仇', '温柔复仇', '隐忍复仇', '疯狂复仇', '正义复仇', '完美复仇', '代价复仇'],
            '女性逆袭': ['丫鬟逆袭', '平民公主', '丑小鸭', '废材觉醒', '配角逆袭', '反派洗白', '穷人翻身', '学渣逆袭', '胖女孩', '乡村女孩', '孤儿逆袭', '残疾坚强'],
            '女性特殊': ['双重人格', '失忆女主', '穿越女', '重生女', '系统女', '替身女', '间谍女', '杀手女', '医生女', '律师女', '警察女', '军人女'],
            '真假千金': ['真千金回归', '假千金不甘', '身世之谜', '血缘认亲', '豪门争夺', '真假对比', '身份互换', '成长环境', '性格差异', '命运转折', '家族认同', '情感归属']
        },
        '男性角色': {
            '霸总类型': ['冷酷霸总', '温柔霸总', '幼稚霸总', '腹黑霸总', '专情霸总', '多金霸总', '权势霸总', '神秘霸总', '年轻霸总', '成熟霸总', '外冷内热', '表里不一'],
            '男性逆袭': ['废柴逆袭', '赘婿翻身', '穷小子', '学渣逆袭', '胖男孩', '丑男变帅', '孤儿奋斗', '残疾坚强', '农村小伙', '打工仔', '小职员', '创业青年'],
            '男性特殊': ['双重人格', '失忆男主', '穿越男', '重生男', '系统男', '替身男', '间谍男', '杀手男', '医生男', '律师男', '警察男', '军人男'],
            '职业设定': ['企业家', '医生', '律师', '教师', '军人', '警察', '消防员', '飞行员', '工程师', '科学家', '艺术家', '运动员'],
            '身份背景': ['豪门少爷', '平民出身', '孤儿', '单亲家庭', '军人世家', '书香门第', '商贾之家', '农民之子', '工人之子', '知识分子', '海归精英', '草根英雄']
        },
        '特殊设定': {
            '萌宝设定': ['天才萌宝', '早熟萌宝', '可爱萌宝', '调皮萌宝', '懂事萌宝', '特殊萌宝', '双胞胎', '龙凤胎', '三胞胎', '收养萌宝', '失散萌宝', '萌宝助攻'],
            '替身设定': ['完美替身', '不甘替身', '身不由己', '情深替身', '复仇替身', '保护替身', '意外替身', '主动替身', '被迫替身', '双胞胎', '相似容貌', '整容替身'],
            '身份设定': ['隐藏身份', '多重身份', '假身份', '交换身份', '神秘身份', '特殊身份', '贵族身份', '平民身份', '外国身份', '古代身份', '未来身份', '虚拟身份'],
            '能力设定': ['超能力', '读心术', '预知未来', '时间控制', '空间能力', '治愈能力', '破坏能力', '隐身能力', '飞行能力', '变身能力', '控制他人', '特殊感知'],
            '关系设定': ['青梅竹马', '欢喜冤家', '师生关系', '上下级', '医患关系', '律师当事人', '保镖雇主', '明星粉丝', '作家读者', '房东房客', '邻居关系', '网友见面']
        }
    },
    '故事背景': {
        '时代背景': {
            '现代都市': ['都市生活', '职场精英', '校园青春', '娱乐圈', '互联网创业', '金融投资', '房地产', '时尚行业', '传媒行业', '教育培训', '医疗健康', '科技公司'],
            '古代背景': ['宫廷后宫', '江湖武林', '宅门深院', '官场朝堂', '商贾世家', '书香门第', '军营戎马', '边疆塞外', '山村田园', '客栈茶楼', '青楼花街', '寺庙道观'],
            '架空世界': ['异世大陆', '修真领域', '末世危机', '魔法世界', '兽人世界', '星际文明', '蒸汽朋克', '赛博朋克', '平行宇宙', '虚拟现实', '游戏世界', '二次元世界'],
            '历史时期': ['民国风云', '八九十年代', '改革开放', '抗战烽火', '文革岁月', '知青下乡', '港台风情', '海外华人', '古代各朝', '近代变革', '建国初期', '特殊年代'],
            '未来世界': ['近未来', '远未来', '末日后', '太空殖民', '人工智能', '生物科技', '环境灾难', '社会变革', '科技奇点', '虚拟社会', '基因改造', '机器人时代']
        },
        '地理背景': {
            '城市环境': ['一线城市', '二三线城市', '县城小镇', '城中村', '高档社区', '老城区', '新区开发', '工业区', '商业中心', '文化区', '科技园区', '大学城'],
            '乡村环境': ['山村', '渔村', '农村', '草原', '边疆', '少数民族地区', '贫困山区', '富裕乡镇', '旅游村镇', '特色小镇', '古镇古村', '移民新村'],
            '特殊环境': ['海岛', '沙漠', '雪山', '森林', '湿地', '洞穴', '地下城', '空中城市', '海底世界', '极地', '火山', '秘境'],
            '文化场所': ['博物馆', '图书馆', '艺术馆', '剧院', '音乐厅', '文化街区', '古迹景点', '宗教场所', '学术机构', '创意园区', '文化村落', '传统工艺坊'],
            '国际背景': ['欧洲', '美洲', '亚洲', '非洲', '大洋洲', '国际都市', '留学生活', '移民社区', '跨国企业', '外交领域', '国际组织', '多元文化']
        }
    },
    '故事类型': {
        '爱情情感': {
            '甜宠爱情': ['初恋甜蜜', '暗恋成真', '日久生情', '青梅竹马', '萌宝助攻', '宠妻如命', '双向暗恋', '网恋奔现', '异地恋', '办公室恋情', '师生恋', '忘年恋'],
            '虐恋情深': ['追妻火葬场', '爱而不得', '错过重逢', '生死离别', '背叛原谅', '身份悬殊', '家族仇恨', '命运捉弄', '痛苦救赎', '深情守护', '无望之爱', '禁忌之恋'],
            '婚姻题材': ['闪婚夫妻', '替嫁情缘', '先婚后爱', '契约婚姻', '假结婚', '离婚复合', '婚姻危机', '中年婚姻', '二婚重组', '跨国婚姻', '政治联姻', '商业联姻'],
            '成熟爱情': ['熟龄浪漫', '父母爱情', '黄昏恋', '重新开始', '情感治愈', '陪伴守护', '平淡温馨', '相濡以沫', '携手到老', '情深不渝', '成熟理解', '包容接纳'],
            '特殊情感': ['三角恋', '多角恋', '竞争恋爱', '替身恋人', '双胞胎恋情', '时空恋人', '人鬼情未了', '人妖恋', '跨种族恋', '虚拟恋人', '记忆恋人', '梦境恋人']
        },
        '玄幻奇幻': {
            '修真仙侠': ['凡人修仙', '天才修炼', '废材逆袭', '宗门争斗', '仙魔大战', '飞升成仙', '双修情缘', '师徒传承', '古神觉醒', '天道轮回', '劫难渡劫', '仙界风云'],
            '玄幻冒险': ['异世穿越', '魔法学院', '龙族传说', '精灵王国', '兽人部落', '魔王复活', '勇者冒险', '公主救援', '宝藏寻找', '魔法契约', '召唤师', '元素掌控'],
            '奇幻魔法': ['魔法世界', '法师学徒', '魔法学校', '魔法师', '魔法生物', '魔法道具', '魔法阵法', '魔法禁术', '魔法王国', '魔法战争', '魔法复苏', '魔法末世'],
            '武侠江湖': ['武林盟主', '江湖恩怨', '门派争斗', '武功秘籍', '侠客行', '刀剑江湖', '武林大会', '江湖儿女', '快意恩仇', '武林传说', '江湖义气', '武道巅峰'],
            '神话传说': ['神话重现', '古神复苏', '神魔之战', '封神榜', '西游记', '山海经', '民间传说', '神仙下凡', '龙王传说', '凤凰涅槃', '麒麟现世', '神兽守护']
        },
        '现实题材': {
            '家庭伦理': ['三代同堂', '婆媳关系', '兄弟姐妹', '父子情深', '母女情结', '家族企业', '家庭秘密', '血缘寻找', '收养情缘', '家庭重组', '隔代教育', '家风传承'],
            '职场生活': ['职场新人', '升职加薪', '办公室政治', '创业艰辛', '商场如战场', '团队合作', '职场霸凌', '跳槽转行', '中年危机', '退休生活', '自主创业', '职场导师'],
            '青春成长': ['校园生活', '青春叛逆', '成长烦恼', '友情岁月', '初恋青涩', '高考压力', '大学时光', '毕业迷茫', '理想现实', '青春无悔', '同窗情深', '师生情谊'],
            '社会现实': ['底层奋斗', '社会不公', '维权斗争', '环保议题', '教育问题', '医疗改革', '住房难题', '就业压力', '养老问题', '留守儿童', '农民工', '城市化进程'],
            '文化传承': ['非遗保护', '传统工艺', '文化复兴', '民族文化', '地方文化', '文化冲突', '文化融合', '文化创新', '文化产业', '文化教育', '文化旅游', '文化自信']
        },
        '悬疑推理': {
            '推理探案': ['名侦探', '警察破案', '私家侦探', '法医探案', '心理推理', '密室杀人', '连环案件', '冷案重启', '真相大白', '证据推理', '逻辑推演', '智斗罪犯'],
            '惊悚恐怖': ['灵异事件', '鬼屋探险', '诅咒传说', '恐怖医院', '废弃学校', '深山老林', '古宅秘密', '邪教组织', '变态杀手', '心理恐怖', '超自然现象', '末日恐慌'],
            '犯罪题材': ['黑社会', '毒品犯罪', '金融犯罪', '网络犯罪', '人口贩卖', '洗钱活动', '间谍活动', '恐怖主义', '组织犯罪', '白领犯罪', '青少年犯罪', '跨国犯罪'],
            '法律正义': ['律师辩护', '法庭审判', '司法公正', '冤案平反', '法律援助', '检察官', '法官', '监狱生活', '罪犯改造', '受害者', '证人保护', '司法改革']
        }
    },

    '剧情机制': {
        '穿越重生': {
            '穿越类型': ['古代穿越', '现代穿越', '未来穿越', '平行世界', '异世穿越', '穿书', '穿游戏', '穿影视', '穿动漫', '来回穿越', '集体穿越', '意外穿越'],
            '重生类型': ['重生复仇', '重生改命', '重生致富', '重生学霸', '重生美女', '重生强者', '重生名人', '重生亲情', '重生爱情', '重生事业', '重生健康', '重生完美'],
            '特殊穿越': ['灵魂互换', '身体互换', '性别互换', '年龄互换', '身份互换', '记忆互换', '能力互换', '命运互换', '时空循环', '梦境穿越', '游戏穿越', '书中穿越'],
            '穿越条件': ['意外死亡', '车祸穿越', '溺水穿越', '雷劈穿越', '疾病穿越', '睡觉穿越', '许愿穿越', '物品穿越', '地点穿越', '时间穿越', '情感穿越', '系统穿越']
        },
        '系统金手指': {
            '系统类型': ['升级系统', '签到系统', '任务系统', '商城系统', '抽奖系统', '学习系统', '美颜系统', '健康系统', '财富系统', '技能系统', '关系系统', '预测系统'],
            '特殊能力': ['透视眼', '读心术', '预知能力', '治愈能力', '控制能力', '变身能力', '隐身能力', '飞行能力', '瞬移能力', '时间控制', '空间能力', '元素控制'],
            '金手指道具': ['神奇戒指', '魔法项链', '特殊手镯', '古董物品', '神秘盒子', '魔法书籍', '特殊手机', '神奇眼镜', '魔法镜子', '特殊植物', '神兽宠物', '时空门'],
            '获得方式': ['系统选中', '意外获得', '继承获得', '购买获得', '捡到获得', '交换获得', '任务奖励', '升级获得', '抽奖获得', '合成获得', '进化获得', '觉醒获得']
        },
        '复仇逆袭': {
            '复仇原因': ['背叛伤害', '家族仇恨', '爱情背叛', '事业陷害', '友情背叛', '亲情伤害', '社会不公', '权势欺压', '财富掠夺', '名誉损害', '身体伤害', '精神折磨'],
            '逆袭方式': ['智慧逆袭', '财富逆袭', '能力逆袭', '身份逆袭', '美貌逆袭', '才华逆袭', '人脉逆袭', '机遇逆袭', '努力逆袭', '运气逆袭', '系统逆袭', '重生逆袭'],
            '身份揭秘': ['隐藏身份', '多重马甲', '神秘背景', '真实实力', '特殊能力', '家族背景', '财富实力', '权势地位', '专业技能', '人际关系', '过往经历', '未来潜力'],
            '反转情节': ['身份反转', '实力反转', '关系反转', '真相反转', '结局反转', '感情反转', '立场反转', '价值反转', '命运反转', '角色反转', '情节反转', '认知反转']
        },
        '特殊情节': {
            '误会情节': ['身份误会', '关系误会', '动机误会', '行为误会', '话语误会', '情感误会', '能力误会', '背景误会', '目的误会', '结果误会', '过程误会', '真相误会'],
            '巧合情节': ['偶然相遇', '意外重逢', '巧合救助', '误打误撞', '阴差阳错', '命运安排', '天意如此', '缘分注定', '机缘巧合', '不期而遇', '意外发现', '偶然获得'],
            '危机情节': ['生命危险', '财产危机', '感情危机', '事业危机', '家庭危机', '健康危机', '名誉危机', '法律危机', '道德危机', '信任危机', '选择危机', '时间危机']
        }
    },
    '题材风格': {
        '动作冒险': {
            '动作类型': ['武打动作', '枪战动作', '爆炸场面', '追车场面', '格斗比赛', '军事行动', '特工任务', '警匪追击', '复仇行动', '救援行动', '冒险探索', '极限运动'],
            '冒险探索': ['宝藏寻找', '遗迹探索', '荒野求生', '深海探险', '太空探索', '地心探险', '考古发现', '科学探索', '未知领域', '危险地带', '神秘事件', '超自然现象'],
            '历史军事': ['古代战争', '现代战争', '未来战争', '抗日战争', '解放战争', '朝鲜战争', '越南战争', '海湾战争', '特种部队', '间谍活动', '军事科技', '战争英雄'],
            '竞技体育': ['足球', '篮球', '网球', '游泳', '田径', '体操', '武术', '拳击', '赛车', '极限运动', '电子竞技', '棋类运动']
        },
        '轻松娱乐': {
            '喜剧搞笑': ['无厘头喜剧', '情景喜剧', '黑色幽默', '讽刺喜剧', '浪漫喜剧', '家庭喜剧', '职场喜剧', '校园喜剧', '古装喜剧', '科幻喜剧', '动作喜剧', '音乐喜剧'],
            '二次元': ['动漫改编', '游戏改编', '漫画改编', '轻小说改编', '同人作品', '原创动漫', 'ACG文化', '宅文化', '萌文化', '腐文化', '百合文化', '偶像文化'],
            '娱乐圈': ['明星生活', '经纪人', '导演制片', '编剧作家', '歌手音乐', '模特时尚', '网红主播', '综艺节目', '选秀比赛', '娱乐记者', '粉丝文化', '娱乐产业'],
            '生活情趣': ['美食文化', '旅游度假', '宠物生活', '园艺种植', '手工制作', '收藏爱好', '摄影艺术', '音乐艺术', '书画艺术', '文学创作', '时尚穿搭', '居家生活']
        },
        '深度题材': {
            '宫斗权谋': ['后宫争斗', '朝堂政治', '权力游戏', '阴谋阳谋', '联盟背叛', '利益纠葛', '政治联姻', '权力传承', '改革变法', '外交斗争', '军事政治', '经济政治'],
            '商战职场': ['企业竞争', '商业谈判', '市场争夺', '技术竞争', '人才争夺', '资本运作', '并购重组', '创业投资', '国际贸易', '金融投资', '房地产', '互联网'],
            '传承文化': ['非遗传承', '传统工艺', '民族文化', '地方文化', '家族传承', '师徒传承', '文化复兴', '文化保护', '文化创新', '文化产业', '文化教育', '文化交流'],
            '社会议题': ['环保议题', '教育问题', '医疗改革', '养老问题', '就业问题', '住房问题', '贫富差距', '社会公平', '法律正义', '道德伦理', '科技伦理', '人工智能']
        }
    },
    '特殊分类': {
        '科幻未来': {
            '科幻题材': ['太空歌剧', '时间旅行', '平行宇宙', '人工智能', '机器人', '克隆人', '基因改造', '虚拟现实', '赛博朋克', '蒸汽朋克', '生物朋克', '太阳朋克'],
            '末世题材': ['丧尸末世', '病毒末世', '核战末世', '气候末世', '外星入侵', '机器叛乱', '资源枯竭', '环境污染', '社会崩溃', '文明倒退', '人类变异', '末世重建'],
            '星际题材': ['星际战争', '星际探索', '星际贸易', '星际殖民', '外星文明', '星际联盟', '银河帝国', '太空海盗', '星际流浪', '星际恋情', '星际政治', '星际科技'],
            '超自然': ['超能力者', '变种人', '异能觉醒', '超自然现象', '平行世界', '时空异常', '维度穿越', '量子世界', '精神世界', '梦境世界', '灵魂世界', '意识世界']
        },
        '多元关系': {
            '复杂关系': ['多角恋情', '三角关系', '四角关系', '群体关系', '网状关系', '循环关系', '对立关系', '竞争关系', '合作关系', '依赖关系', '互补关系', '平衡关系'],
            '特殊关系': ['师生恋', '医患恋', '上下级恋', '主仆恋', '保镖恋', '明星粉丝', '作家读者', '房东房客', '邻居恋', '网友恋', '笔友恋', '游戏恋'],
            '年龄差恋': ['姐弟恋', '师生恋', '忘年恋', '代沟恋', '跨代恋', '老夫少妻', '少夫老妻', '同龄恋', '童年恋', '青春恋', '中年恋', '老年恋'],
            '身份差恋': ['贫富差距', '地位悬殊', '职业差异', '教育差异', '文化差异', '国籍差异', '种族差异', '宗教差异', '价值观差异', '生活方式差异', '家庭背景差异', '成长环境差异']
        },
        '其他特色': {
            '美食生活': ['厨师料理', '美食家', '餐厅经营', '食材寻找', '烹饪比赛', '美食旅行', '传统美食', '创新料理', '街头小吃', '高级料理', '家常菜', '节庆美食'],
            '医疗题材': ['医生护士', '医院生活', '疾病治疗', '医学研究', '医疗改革', '医患关系', '医疗事故', '医疗伦理', '急诊科', '手术室', '儿科', '妇产科'],
            '教育题材': ['学校生活', '师生关系', '教育改革', '应试教育', '素质教育', '特殊教育', '职业教育', '成人教育', '家庭教育', '社会教育', '在线教育', '国际教育'],
            '法律题材': ['律师生活', '法庭审判', '法律援助', '司法改革', '法律伦理', '犯罪预防', '受害者保护', '法律教育', '法律服务', '国际法', '商法', '刑法'],
            '心理题材': ['心理咨询', '心理治疗', '心理疾病', '心理健康', '心理成长', '心理创伤', '心理康复', '心理分析', '心理测试', '心理干预', '心理教育', '心理研究']
        }
    }
};

export interface GenreSelectionPopupProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (selection: { paths: string[][] }) => void;
    currentSelectionPaths: string[][];
    disabledOptions?: string[]; // Optional array of genre paths to disable
}

const GenreSelectionPopup: React.FC<GenreSelectionPopupProps> = ({
    visible,
    onClose,
    onSelect,
    currentSelectionPaths,
    disabledOptions = [] // Default to empty array if not provided
}) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [navigationPath, setNavigationPath] = useState<string[]>([]);
    const [tempSelectedPaths, setTempSelectedPaths] = useState<string[][]>(currentSelectionPaths);
    const [activeNavigationPath, setActiveNavigationPath] = useState<string[]>([]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (visible) {
            setTempSelectedPaths(currentSelectionPaths);
            setNavigationPath([]);
            if (!isMobile) {
                if (currentSelectionPaths.length > 0 && currentSelectionPaths[0].length > 0) {
                    setActiveNavigationPath(currentSelectionPaths[0].slice(0, -1));
                } else {
                    setActiveNavigationPath([]);
                }
            }
        }
    }, [visible, currentSelectionPaths, isMobile]);

    const isOptionDisabled = (path: string[]) => {
        // Check if the path is in disabledOptions
        if (disabledOptions.some(disabledPath =>
            JSON.stringify(disabledPath) === JSON.stringify(path))) {
            return true;
        }

        // Check if the path contains any disabled segments
        const pathString = path.join(' > ');
        return pathString.includes('disabled');
    };

    const getDataAtPath = (path: string[]) => {
        let current: any = genreOptions;
        for (const segment of path) {
            if (segment === 'disabled') continue;
            current = current[segment];
            if (!current) return null;
        }
        return current;
    };

    const hasChildren = (path: string[], key: string) => {
        const data = getDataAtPath([...path, key]);
        return data && typeof data === 'object' && !Array.isArray(data);
    };

    const isDeepestLevel = (path: string[], key: string) => {
        const data = getDataAtPath([...path, key]);
        if (Array.isArray(data)) {
            return data.length <= 1 || (data.length === 2 && data.includes('disabled'));
        }
        if (data && typeof data === 'object') {
            const children = Object.keys(data);
            if (children.length === 1) {
                const childData = data[children[0]];
                if (Array.isArray(childData) && (childData.length <= 1 || (childData.length === 2 && childData.includes('disabled')))) {
                    return true;
                }
            }
        }
        return false;
    };

    const handleNavigationClick = (pathForNextColumn: string[]) => {
        if (isMobile) {
            setNavigationPath(pathForNextColumn);
        } else {
            setActiveNavigationPath(pathForNextColumn);
        }
    };

    const handleCheckboxChange = (itemPath: string[], itemName: string) => {
        const fullItemPath = [...itemPath, itemName];

        // Don't allow selection if the option is disabled
        if (isOptionDisabled(fullItemPath)) {
            return;
        }

        setTempSelectedPaths(prevSelectedPaths => {
            const isAlreadySelected = prevSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(fullItemPath));
            if (isAlreadySelected) {
                return prevSelectedPaths.filter(p => JSON.stringify(p) !== JSON.stringify(fullItemPath));
            } else {
                if (prevSelectedPaths.length < MAX_GENRE_SELECTIONS) {
                    return [...prevSelectedPaths, fullItemPath];
                } else {
                    return prevSelectedPaths;
                }
            }
        });
    };

    const handleRemoveSelectedItem = (indexToRemove: number) => {
        const newSelectedPaths = tempSelectedPaths.filter((_, index) => index !== indexToRemove);
        setTempSelectedPaths(newSelectedPaths);
    };

    const handleConfirm = () => {
        if (tempSelectedPaths.length > 0 && tempSelectedPaths.length <= MAX_GENRE_SELECTIONS) {
            onSelect({ paths: tempSelectedPaths });
            onClose();
        }
    };

    const handleCancel = () => {
        setTempSelectedPaths(currentSelectionPaths);
        onClose();
    };

    const renderSelectedItemsTags = () => {
        if (tempSelectedPaths.length === 0) return null;

        return (
            <Card size="small" style={{ marginTop: 16 }}>
                <Title level={5} style={{ marginBottom: 16 }}>已选择的故事类型</Title>
                <Space wrap>
                    {tempSelectedPaths.map((path, index) => {
                        const pathString = path.join(' > ');
                        return (
                            <Tag
                                key={index}
                                closable
                                onClose={() => handleRemoveSelectedItem(index)}
                                color="blue"
                                style={{ marginBottom: 8 }}
                            >
                                {pathString}
                            </Tag>
                        );
                    })}
                </Space>
            </Card>
        );
    };

    const createMenuItems = (data: any, basePath: string[] = []): MenuProps['items'] => {
        if (!data || typeof data !== 'object' || Array.isArray(data)) return [];

        return Object.keys(data).map(key => {
            const itemPath = [...basePath, key];
            const itemHasChildren = hasChildren(basePath, key);
            const itemIsDeepest = isDeepestLevel(basePath, key);
            const canSelectItem = !itemHasChildren || itemIsDeepest;
            const isSelected = tempSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(itemPath));

            return {
                key: itemPath.join('|'),
                label: (
                    <Flex justify="space-between" align="center">
                        <Flex align="center">
                            {canSelectItem && (
                                <Checkbox
                                    checked={isSelected}
                                    onChange={() => handleCheckboxChange(basePath, key)}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={!isSelected && tempSelectedPaths.length >= MAX_GENRE_SELECTIONS}
                                    style={{ marginRight: 8 }}
                                />
                            )}
                            <span>{key}</span>
                        </Flex>
                        {itemHasChildren && !itemIsDeepest && <RightOutlined style={{ fontSize: 10 }} />}
                    </Flex>
                ),
                onClick: () => {
                    if (itemHasChildren && !itemIsDeepest) {
                        handleNavigationClick(itemPath);
                    } else if (canSelectItem) {
                        handleCheckboxChange(basePath, key);
                    }
                }
            };
        });
    };

    const renderMillerColumns = () => {
        const columns: React.ReactElement[] = [];
        let currentLevelData: any = genreOptions;
        let currentPathSegmentsForRender: string[] = [];

        // Root column
        columns.push(
            <Card key="col-root" size="small" style={{ width: COLUMN_WIDTH, height: COLUMN_HEIGHT, overflow: 'auto' }}>
                <Menu
                    mode="vertical"
                    selectedKeys={activeNavigationPath.length > 0 ? [activeNavigationPath[0]] : []}
                    items={createMenuItems(currentLevelData)}
                    style={{ border: 'none' }}
                />
            </Card>
        );

        // Additional columns based on navigation path
        for (let i = 0; i < activeNavigationPath.length; i++) {
            currentPathSegmentsForRender = activeNavigationPath.slice(0, i + 1);
            currentLevelData = getDataAtPath(currentPathSegmentsForRender);

            if (currentLevelData && typeof currentLevelData === 'object' && !Array.isArray(currentLevelData)) {
                columns.push(
                    <Card key={`col-${i}`} size="small" style={{ width: COLUMN_WIDTH, height: COLUMN_HEIGHT, overflow: 'auto' }}>
                        <Menu
                            mode="vertical"
                            selectedKeys={activeNavigationPath.length > i + 1 ? [activeNavigationPath[i + 1]] : []}
                            items={createMenuItems(currentLevelData, currentPathSegmentsForRender)}
                            style={{ border: 'none' }}
                        />
                    </Card>
                );
            } else {
                break;
            }
        }

        // Add placeholder columns to maintain consistent width
        while (columns.length < MAX_COLUMNS) {
            columns.push(
                <Card key={`placeholder-${columns.length}`} size="small" style={{ width: COLUMN_WIDTH, height: COLUMN_HEIGHT, opacity: 0.3 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
                        <Text type="secondary">选择左侧分类</Text>
                    </div>
                </Card>
            );
        }

        return (
            <Flex vertical>
                <Flex gap={COLUMN_GAP} style={{ paddingBottom: tempSelectedPaths.length > 0 ? 16 : 0 }}>
                    {columns}
                </Flex>
                {tempSelectedPaths.length >= MAX_GENRE_SELECTIONS && (
                    <Alert
                        message={`已选择最大数量 (${MAX_GENRE_SELECTIONS}个) 的故事类型`}
                        description="如需选择其他类型，请先移除已选择的类型。"
                        type="info"
                        showIcon
                        style={{ margin: '16px 0' }}
                    />
                )}
                {tempSelectedPaths.length > 0 && renderSelectedItemsTags()}
            </Flex>
        );
    };

    const renderBreadcrumb = () => {
        const breadcrumbItems = [
            {
                title: <HomeOutlined />,
            },
            ...navigationPath.map((segment, index) => ({
                title: segment,
                onClick: () => setNavigationPath(navigationPath.slice(0, index + 1))
            }))
        ];

        return (
            <Breadcrumb
                items={breadcrumbItems}
                style={{ marginBottom: 16 }}
            />
        );
    };

    const renderSingleView = () => {
        const currentDataToDisplay = getDataAtPath(navigationPath);

        return (
            <Flex vertical style={{ height: '100%' }}>
                {navigationPath.length > 0 && renderBreadcrumb()}

                <div style={{ flex: 1, paddingBottom: tempSelectedPaths.length > 0 ? 16 : 0 }}>
                    {currentDataToDisplay && typeof currentDataToDisplay === 'object' && !Array.isArray(currentDataToDisplay) ? (
                        <List
                            dataSource={Object.keys(currentDataToDisplay)}
                            renderItem={(key) => {
                                const itemFullPath = [...navigationPath, key];
                                const isItemSelected = tempSelectedPaths.some(p => JSON.stringify(p) === JSON.stringify(itemFullPath));
                                const itemHasChildren = hasChildren(navigationPath, key);
                                const itemIsDeepest = isDeepestLevel(navigationPath, key);
                                const canSelectItem = !itemHasChildren || itemIsDeepest;

                                return (
                                    <List.Item
                                        onClick={() => {
                                            if (itemHasChildren && !itemIsDeepest) {
                                                handleNavigationClick(itemFullPath);
                                            } else if (canSelectItem) {
                                                handleCheckboxChange(navigationPath, key);
                                            }
                                        }}
                                        style={{
                                            cursor: 'pointer',
                                            backgroundColor: isItemSelected ? '#1890ff10' : 'transparent',
                                            padding: '12px 16px',
                                            borderRadius: 6
                                        }}
                                        actions={[
                                            itemHasChildren && !itemIsDeepest ? <RightOutlined key="arrow" /> : null
                                        ].filter(Boolean)}
                                    >
                                        <List.Item.Meta
                                            avatar={canSelectItem ? (
                                                <Checkbox
                                                    checked={isItemSelected}
                                                    onChange={() => handleCheckboxChange(navigationPath, key)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    disabled={!isItemSelected && tempSelectedPaths.length >= MAX_GENRE_SELECTIONS}
                                                />
                                            ) : null}
                                            title={key}
                                        />
                                    </List.Item>
                                );
                            }}
                        />
                    ) : (
                        <Text type="secondary" style={{ padding: 16, display: 'block', textAlign: 'center' }}>
                            当前分类下没有更多子选项
                        </Text>
                    )}
                </div>

                {tempSelectedPaths.length > 0 && renderSelectedItemsTags()}
            </Flex>
        );
    };

    const drawerHeight = tempSelectedPaths.length > 0 ? '85vh' : '70vh';

    if (isMobile) {
        return (
            <Drawer
                title="选择故事类型"
                placement="bottom"
                height={drawerHeight}
                onClose={handleCancel}
                open={visible}
                footer={
                    <Space>
                        <Button onClick={handleCancel}>
                            取消
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleConfirm}
                            disabled={tempSelectedPaths.length === 0 || tempSelectedPaths.length > MAX_GENRE_SELECTIONS}
                        >
                            确定 ({tempSelectedPaths.length})
                        </Button>
                    </Space>
                }
            >
                {renderSingleView()}
            </Drawer>
        );
    }

    return (
        <Modal
            title="选择故事类型"
            open={visible}
            onCancel={handleCancel}
            width={MODAL_WIDTH}
            centered
            footer={[
                <Button key="cancel" onClick={handleCancel}>
                    取消
                </Button>,
                <Button
                    key="confirm"
                    type="primary"
                    onClick={handleConfirm}
                    disabled={tempSelectedPaths.length === 0 || tempSelectedPaths.length > MAX_GENRE_SELECTIONS}
                >
                    确定 ({tempSelectedPaths.length})
                </Button>
            ]}
        >
            {renderMillerColumns()}
        </Modal>
    );
};

export default GenreSelectionPopup; 