// Genre selection data structure
export interface GenreSelection {
    label: string;
    selections?: GenreSelection[];
}

// New proper format - building section by section
export const genreSelections: GenreSelection[] = [
    {
        label: '人物设定',
        selections: [
            {
                label: '女性角色',
                selections: [
                    {
                        label: '女性成长',
                        selections: [
                            { label: '女性觉醒' },
                            { label: '独立自强' },
                            { label: '事业女性' },
                            { label: '全职妈妈' },
                            { label: '单身贵族' },
                            { label: '女强人' },
                            { label: '知识女性' },
                            { label: '艺术女性' },
                            { label: '运动女性' },
                            { label: '创业女性' },
                            { label: '公益女性' },
                            { label: '科技女性' }
                        ]
                    },
                    {
                        label: '女性复仇',
                        selections: [
                            { label: '复仇女神' },
                            { label: '反转打脸' },
                            { label: '以牙还牙' },
                            { label: '绝地反击' },
                            { label: '冷酷复仇' },
                            { label: '智慧复仇' },
                            { label: '温柔复仇' },
                            { label: '隐忍复仇' },
                            { label: '疯狂复仇' },
                            { label: '正义复仇' },
                            { label: '完美复仇' },
                            { label: '代价复仇' }
                        ]
                    },
                    {
                        label: '女性逆袭',
                        selections: [
                            { label: '丫鬟逆袭' },
                            { label: '平民公主' },
                            { label: '丑小鸭' },
                            { label: '废材觉醒' },
                            { label: '配角逆袭' },
                            { label: '反派洗白' },
                            { label: '穷人翻身' },
                            { label: '学渣逆袭' },
                            { label: '胖女孩' },
                            { label: '乡村女孩' },
                            { label: '孤儿逆袭' },
                            { label: '残疾坚强' }
                        ]
                    },
                    {
                        label: '女性特殊',
                        selections: [
                            { label: '双重人格' },
                            { label: '失忆女主' },
                            { label: '穿越女' },
                            { label: '重生女' },
                            { label: '系统女' },
                            { label: '替身女' },
                            { label: '间谍女' },
                            { label: '杀手女' },
                            { label: '医生女' },
                            { label: '律师女' },
                            { label: '警察女' },
                            { label: '军人女' }
                        ]
                    },
                    {
                        label: '真假千金',
                        selections: [
                            { label: '真千金回归' },
                            { label: '假千金不甘' },
                            { label: '身世之谜' },
                            { label: '血缘认亲' },
                            { label: '豪门争夺' },
                            { label: '真假对比' },
                            { label: '身份互换' },
                            { label: '成长环境' },
                            { label: '性格差异' },
                            { label: '命运转折' },
                            { label: '家族认同' },
                            { label: '情感归属' }
                        ]
                    }
                ]
            },
            {
                label: '男性角色',
                selections: [
                    {
                        label: '霸总类型',
                        selections: [
                            { label: '冷酷霸总' },
                            { label: '温柔霸总' },
                            { label: '幼稚霸总' },
                            { label: '腹黑霸总' },
                            { label: '专情霸总' },
                            { label: '多金霸总' },
                            { label: '权势霸总' },
                            { label: '神秘霸总' },
                            { label: '年轻霸总' },
                            { label: '成熟霸总' },
                            { label: '外冷内热' },
                            { label: '表里不一' }
                        ]
                    },
                    {
                        label: '男性逆袭',
                        selections: [
                            { label: '废柴逆袭' },
                            { label: '赘婿翻身' },
                            { label: '穷小子' },
                            { label: '学渣逆袭' },
                            { label: '胖男孩' },
                            { label: '丑男变帅' },
                            { label: '孤儿奋斗' },
                            { label: '残疾坚强' },
                            { label: '农村小伙' },
                            { label: '打工仔' },
                            { label: '小职员' },
                            { label: '创业青年' }
                        ]
                    },
                    {
                        label: '男性特殊',
                        selections: [
                            { label: '双重人格' },
                            { label: '失忆男主' },
                            { label: '穿越男' },
                            { label: '重生男' },
                            { label: '系统男' },
                            { label: '替身男' },
                            { label: '间谍男' },
                            { label: '杀手男' },
                            { label: '医生男' },
                            { label: '律师男' },
                            { label: '警察男' },
                            { label: '军人男' }
                        ]
                    },
                    {
                        label: '职业设定',
                        selections: [
                            { label: '企业家' },
                            { label: '医生' },
                            { label: '律师' },
                            { label: '教师' },
                            { label: '军人' },
                            { label: '警察' },
                            { label: '消防员' },
                            { label: '飞行员' },
                            { label: '工程师' },
                            { label: '科学家' },
                            { label: '艺术家' },
                            { label: '运动员' }
                        ]
                    },
                    {
                        label: '身份背景',
                        selections: [
                            { label: '豪门少爷' },
                            { label: '平民出身' },
                            { label: '孤儿' },
                            { label: '单亲家庭' },
                            { label: '军人世家' },
                            { label: '书香门第' },
                            { label: '商贾之家' },
                            { label: '农民之子' },
                            { label: '工人之子' },
                            { label: '知识分子' },
                            { label: '海归精英' },
                            { label: '草根英雄' }
                        ]
                    }
                ]
            },
            {
                label: '特殊设定',
                selections: [
                    {
                        label: '萌宝设定',
                        selections: [
                            { label: '天才萌宝' },
                            { label: '早熟萌宝' },
                            { label: '可爱萌宝' },
                            { label: '调皮萌宝' },
                            { label: '懂事萌宝' },
                            { label: '特殊萌宝' },
                            { label: '双胞胎' },
                            { label: '龙凤胎' },
                            { label: '三胞胎' },
                            { label: '收养萌宝' },
                            { label: '失散萌宝' },
                            { label: '萌宝助攻' }
                        ]
                    },
                    {
                        label: '替身设定',
                        selections: [
                            { label: '完美替身' },
                            { label: '不甘替身' },
                            { label: '身不由己' },
                            { label: '情深替身' },
                            { label: '复仇替身' },
                            { label: '保护替身' },
                            { label: '意外替身' },
                            { label: '主动替身' },
                            { label: '被迫替身' },
                            { label: '双胞胎' },
                            { label: '相似容貌' },
                            { label: '整容替身' }
                        ]
                    },
                    {
                        label: '身份设定',
                        selections: [
                            { label: '隐藏身份' },
                            { label: '多重身份' },
                            { label: '假身份' },
                            { label: '交换身份' },
                            { label: '神秘身份' },
                            { label: '特殊身份' },
                            { label: '贵族身份' },
                            { label: '平民身份' },
                            { label: '外国身份' },
                            { label: '古代身份' },
                            { label: '未来身份' },
                            { label: '虚拟身份' }
                        ]
                    },
                    {
                        label: '能力设定',
                        selections: [
                            { label: '超能力' },
                            { label: '读心术' },
                            { label: '预知未来' },
                            { label: '时间控制' },
                            { label: '空间能力' },
                            { label: '治愈能力' },
                            { label: '破坏能力' },
                            { label: '隐身能力' },
                            { label: '飞行能力' },
                            { label: '变身能力' },
                            { label: '控制他人' },
                            { label: '特殊感知' }
                        ]
                    },
                    {
                        label: '关系设定',
                        selections: [
                            { label: '青梅竹马' },
                            { label: '欢喜冤家' },
                            { label: '师生关系' },
                            { label: '上下级' },
                            { label: '医患关系' },
                            { label: '律师当事人' },
                            { label: '保镖雇主' },
                            { label: '明星粉丝' },
                            { label: '作家读者' },
                            { label: '房东房客' },
                            { label: '邻居关系' },
                            { label: '网友见面' }
                        ]
                    }
                ]
            }
        ]
    },
    {
        label: '故事背景',
        selections: [
            {
                label: '时代背景',
                selections: [
                    {
                        label: '现代都市',
                        selections: [
                            { label: '都市生活' },
                            { label: '职场精英' },
                            { label: '校园青春' },
                            { label: '娱乐圈' },
                            { label: '互联网创业' },
                            { label: '金融投资' },
                            { label: '房地产' },
                            { label: '时尚行业' },
                            { label: '传媒行业' },
                            { label: '教育培训' },
                            { label: '医疗健康' },
                            { label: '科技公司' }
                        ]
                    },
                    {
                        label: '古代背景',
                        selections: [
                            { label: '宫廷后宫' },
                            { label: '江湖武林' },
                            { label: '宅门深院' },
                            { label: '官场朝堂' },
                            { label: '商贾世家' },
                            { label: '书香门第' },
                            { label: '军营戎马' },
                            { label: '边疆塞外' },
                            { label: '山村田园' },
                            { label: '客栈茶楼' },
                            { label: '青楼花街' },
                            { label: '寺庙道观' }
                        ]
                    },
                    {
                        label: '架空世界',
                        selections: [
                            { label: '异世大陆' },
                            { label: '修真领域' },
                            { label: '末世危机' },
                            { label: '魔法世界' },
                            { label: '兽人世界' },
                            { label: '星际文明' },
                            { label: '蒸汽朋克' },
                            { label: '赛博朋克' },
                            { label: '平行宇宙' },
                            { label: '虚拟现实' },
                            { label: '游戏世界' },
                            { label: '二次元世界' }
                        ]
                    },
                    {
                        label: '历史时期',
                        selections: [
                            { label: '民国风云' },
                            { label: '八九十年代' },
                            { label: '改革开放' },
                            { label: '抗战烽火' },
                            { label: '文革岁月' },
                            { label: '知青下乡' },
                            { label: '港台风情' },
                            { label: '海外华人' },
                            { label: '古代各朝' },
                            { label: '近代变革' },
                            { label: '建国初期' },
                            { label: '特殊年代' }
                        ]
                    },
                    {
                        label: '未来世界',
                        selections: [
                            { label: '近未来' },
                            { label: '远未来' },
                            { label: '末日后' },
                            { label: '太空殖民' },
                            { label: '人工智能' },
                            { label: '生物科技' },
                            { label: '环境灾难' },
                            { label: '社会变革' },
                            { label: '科技奇点' },
                            { label: '虚拟社会' },
                            { label: '基因改造' },
                            { label: '机器人时代' }
                        ]
                    }
                ]
            },
            {
                label: '地理背景',
                selections: [
                    {
                        label: '城市环境',
                        selections: [
                            { label: '一线城市' },
                            { label: '二三线城市' },
                            { label: '县城小镇' },
                            { label: '城中村' },
                            { label: '高档社区' },
                            { label: '老城区' },
                            { label: '新区开发' },
                            { label: '工业区' },
                            { label: '商业中心' },
                            { label: '文化区' },
                            { label: '科技园区' },
                            { label: '大学城' }
                        ]
                    },
                    {
                        label: '乡村环境',
                        selections: [
                            { label: '山村' },
                            { label: '渔村' },
                            { label: '农村' },
                            { label: '草原' },
                            { label: '边疆' },
                            { label: '少数民族地区' },
                            { label: '贫困山区' },
                            { label: '富裕乡镇' },
                            { label: '旅游村镇' },
                            { label: '特色小镇' },
                            { label: '古镇古村' },
                            { label: '移民新村' }
                        ]
                    },
                    {
                        label: '特殊环境',
                        selections: [
                            { label: '海岛' },
                            { label: '沙漠' },
                            { label: '雪山' },
                            { label: '森林' },
                            { label: '湿地' },
                            { label: '洞穴' },
                            { label: '地下城' },
                            { label: '空中城市' },
                            { label: '海底世界' },
                            { label: '极地' },
                            { label: '火山' },
                            { label: '秘境' }
                        ]
                    },
                    {
                        label: '文化场所',
                        selections: [
                            { label: '博物馆' },
                            { label: '图书馆' },
                            { label: '艺术馆' },
                            { label: '剧院' },
                            { label: '音乐厅' },
                            { label: '文化街区' },
                            { label: '古迹景点' },
                            { label: '宗教场所' },
                            { label: '学术机构' },
                            { label: '创意园区' },
                            { label: '文化村落' },
                            { label: '传统工艺坊' }
                        ]
                    },
                    {
                        label: '国际背景',
                        selections: [
                            { label: '欧洲' },
                            { label: '美洲' },
                            { label: '亚洲' },
                            { label: '非洲' },
                            { label: '大洋洲' },
                            { label: '国际都市' },
                            { label: '留学生活' },
                            { label: '移民社区' },
                            { label: '跨国企业' },
                            { label: '外交领域' },
                            { label: '国际组织' },
                            { label: '多元文化' }
                        ]
                    }
                ]
            }
        ]
    },
    {
        label: '故事类型',
        selections: [
            {
                label: '爱情情感',
                selections: [
                    {
                        label: '甜宠爱情',
                        selections: [
                            { label: '初恋甜蜜' },
                            { label: '暗恋成真' },
                            { label: '日久生情' },
                            { label: '青梅竹马' },
                            { label: '萌宝助攻' },
                            { label: '宠妻如命' },
                            { label: '双向暗恋' },
                            { label: '网恋奔现' },
                            { label: '异地恋' },
                            { label: '办公室恋情' },
                            { label: '师生恋' },
                            { label: '忘年恋' }
                        ]
                    },
                    {
                        label: '虐恋情深',
                        selections: [
                            { label: '追妻火葬场' },
                            { label: '爱而不得' },
                            { label: '错过重逢' },
                            { label: '生死离别' },
                            { label: '背叛原谅' },
                            { label: '身份悬殊' },
                            { label: '家族仇恨' },
                            { label: '命运捉弄' },
                            { label: '痛苦救赎' },
                            { label: '深情守护' },
                            { label: '无望之爱' },
                            { label: '禁忌之恋' }
                        ]
                    },
                    {
                        label: '婚姻题材',
                        selections: [
                            { label: '闪婚夫妻' },
                            { label: '替嫁情缘' },
                            { label: '先婚后爱' },
                            { label: '契约婚姻' },
                            { label: '假结婚' },
                            { label: '离婚复合' },
                            { label: '婚姻危机' },
                            { label: '中年婚姻' },
                            { label: '二婚重组' },
                            { label: '跨国婚姻' },
                            { label: '政治联姻' },
                            { label: '商业联姻' }
                        ]
                    },
                    {
                        label: '成熟爱情',
                        selections: [
                            { label: '熟龄浪漫' },
                            { label: '父母爱情' },
                            { label: '黄昏恋' },
                            { label: '重新开始' },
                            { label: '情感治愈' },
                            { label: '陪伴守护' },
                            { label: '平淡温馨' },
                            { label: '相濡以沫' },
                            { label: '携手到老' },
                            { label: '情深不渝' },
                            { label: '成熟理解' },
                            { label: '包容接纳' }
                        ]
                    },
                    {
                        label: '特殊情感',
                        selections: [
                            { label: '三角恋' },
                            { label: '多角恋' },
                            { label: '竞争恋爱' },
                            { label: '替身恋人' },
                            { label: '双胞胎恋情' },
                            { label: '时空恋人' },
                            { label: '人鬼情未了' },
                            { label: '人妖恋' },
                            { label: '跨种族恋' },
                            { label: '虚拟恋人' },
                            { label: '记忆恋人' },
                            { label: '梦境恋人' }
                        ]
                    }
                ]
            },
            {
                label: '玄幻奇幻',
                selections: [
                    {
                        label: '修真仙侠',
                        selections: [
                            { label: '凡人修仙' },
                            { label: '天才修炼' },
                            { label: '废材逆袭' },
                            { label: '宗门争斗' },
                            { label: '仙魔大战' },
                            { label: '飞升成仙' },
                            { label: '双修情缘' },
                            { label: '师徒传承' },
                            { label: '古神觉醒' },
                            { label: '天道轮回' },
                            { label: '劫难渡劫' },
                            { label: '仙界风云' }
                        ]
                    },
                    {
                        label: '玄幻冒险',
                        selections: [
                            { label: '异世穿越' },
                            { label: '魔法学院' },
                            { label: '龙族传说' },
                            { label: '精灵王国' },
                            { label: '兽人部落' },
                            { label: '魔王复活' },
                            { label: '勇者冒险' },
                            { label: '公主救援' },
                            { label: '宝藏寻找' },
                            { label: '魔法契约' },
                            { label: '召唤师' },
                            { label: '元素掌控' }
                        ]
                    },
                    {
                        label: '奇幻魔法',
                        selections: [
                            { label: '魔法世界' },
                            { label: '法师学徒' },
                            { label: '魔法学校' },
                            { label: '魔法师' },
                            { label: '魔法生物' },
                            { label: '魔法道具' },
                            { label: '魔法阵法' },
                            { label: '魔法禁术' },
                            { label: '魔法王国' },
                            { label: '魔法战争' },
                            { label: '魔法复苏' },
                            { label: '魔法末世' }
                        ]
                    },
                    {
                        label: '武侠江湖',
                        selections: [
                            { label: '武林盟主' },
                            { label: '江湖恩怨' },
                            { label: '门派争斗' },
                            { label: '武功秘籍' },
                            { label: '侠客行' },
                            { label: '刀剑江湖' },
                            { label: '武林大会' },
                            { label: '江湖儿女' },
                            { label: '快意恩仇' },
                            { label: '武林传说' },
                            { label: '江湖义气' },
                            { label: '武道巅峰' }
                        ]
                    },
                    {
                        label: '神话传说',
                        selections: [
                            { label: '神话重现' },
                            { label: '古神复苏' },
                            { label: '神魔之战' },
                            { label: '封神榜' },
                            { label: '西游记' },
                            { label: '山海经' },
                            { label: '民间传说' },
                            { label: '神仙下凡' },
                            { label: '龙王传说' },
                            { label: '凤凰涅槃' },
                            { label: '麒麟现世' },
                            { label: '神兽守护' }
                        ]
                    }
                ]
            },
            {
                label: '现实题材',
                selections: [
                    {
                        label: '家庭伦理',
                        selections: [
                            { label: '三代同堂' },
                            { label: '婆媳关系' },
                            { label: '兄弟姐妹' },
                            { label: '父子情深' },
                            { label: '母女情结' },
                            { label: '家族企业' },
                            { label: '家庭秘密' },
                            { label: '血缘寻找' },
                            { label: '收养情缘' },
                            { label: '家庭重组' },
                            { label: '隔代教育' },
                            { label: '家风传承' }
                        ]
                    },
                    {
                        label: '职场生活',
                        selections: [
                            { label: '职场新人' },
                            { label: '升职加薪' },
                            { label: '办公室政治' },
                            { label: '创业艰辛' },
                            { label: '商场如战场' },
                            { label: '团队合作' },
                            { label: '职场霸凌' },
                            { label: '跳槽转行' },
                            { label: '中年危机' },
                            { label: '退休生活' },
                            { label: '自主创业' },
                            { label: '职场导师' }
                        ]
                    },
                    {
                        label: '青春成长',
                        selections: [
                            { label: '校园生活' },
                            { label: '青春叛逆' },
                            { label: '成长烦恼' },
                            { label: '友情岁月' },
                            { label: '初恋青涩' },
                            { label: '高考压力' },
                            { label: '大学时光' },
                            { label: '毕业迷茫' },
                            { label: '理想现实' },
                            { label: '青春无悔' },
                            { label: '同窗情深' },
                            { label: '师生情谊' }
                        ]
                    },
                    {
                        label: '社会现实',
                        selections: [
                            { label: '底层奋斗' },
                            { label: '社会不公' },
                            { label: '维权斗争' },
                            { label: '环保议题' },
                            { label: '教育问题' },
                            { label: '医疗改革' },
                            { label: '住房难题' },
                            { label: '就业压力' },
                            { label: '养老问题' },
                            { label: '留守儿童' },
                            { label: '农民工' },
                            { label: '城市化进程' }
                        ]
                    },
                    {
                        label: '文化传承',
                        selections: [
                            { label: '非遗保护' },
                            { label: '传统工艺' },
                            { label: '文化复兴' },
                            { label: '民族文化' },
                            { label: '地方文化' },
                            { label: '文化冲突' },
                            { label: '文化融合' },
                            { label: '文化创新' },
                            { label: '文化产业' },
                            { label: '文化教育' },
                            { label: '文化旅游' },
                            { label: '文化自信' }
                        ]
                    }
                ]
            },
            {
                label: '悬疑推理',
                selections: [
                    {
                        label: '推理探案',
                        selections: [
                            { label: '名侦探' },
                            { label: '警察破案' },
                            { label: '私家侦探' },
                            { label: '法医探案' },
                            { label: '心理推理' },
                            { label: '密室杀人' },
                            { label: '连环案件' },
                            { label: '冷案重启' },
                            { label: '真相大白' },
                            { label: '证据推理' },
                            { label: '逻辑推演' },
                            { label: '智斗罪犯' }
                        ]
                    },
                    {
                        label: '惊悚恐怖',
                        selections: [
                            { label: '灵异事件' },
                            { label: '鬼屋探险' },
                            { label: '诅咒传说' },
                            { label: '恐怖医院' },
                            { label: '废弃学校' },
                            { label: '深山老林' },
                            { label: '古宅秘密' },
                            { label: '邪教组织' },
                            { label: '变态杀手' },
                            { label: '心理恐怖' },
                            { label: '超自然现象' },
                            { label: '末日恐慌' }
                        ]
                    },
                    {
                        label: '犯罪题材',
                        selections: [
                            { label: '黑社会' },
                            { label: '毒品犯罪' },
                            { label: '金融犯罪' },
                            { label: '网络犯罪' },
                            { label: '人口贩卖' },
                            { label: '洗钱活动' },
                            { label: '间谍活动' },
                            { label: '恐怖主义' },
                            { label: '组织犯罪' },
                            { label: '白领犯罪' },
                            { label: '青少年犯罪' },
                            { label: '跨国犯罪' }
                        ]
                    },
                    {
                        label: '法律正义',
                        selections: [
                            { label: '律师辩护' },
                            { label: '法庭审判' },
                            { label: '司法公正' },
                            { label: '冤案平反' },
                            { label: '法律援助' },
                            { label: '检察官' },
                            { label: '法官' },
                            { label: '监狱生活' },
                            { label: '罪犯改造' },
                            { label: '受害者' },
                            { label: '证人保护' },
                            { label: '司法改革' }
                        ]
                    }
                ]
            }
        ]
    },
    {
        label: '剧情机制',
        selections: [
            {
                label: '穿越重生',
                selections: [
                    {
                        label: '穿越类型',
                        selections: [
                            { label: '古代穿越' },
                            { label: '现代穿越' },
                            { label: '未来穿越' },
                            { label: '平行世界' },
                            { label: '异世穿越' },
                            { label: '穿书' },
                            { label: '穿游戏' },
                            { label: '穿影视' },
                            { label: '穿动漫' },
                            { label: '来回穿越' },
                            { label: '集体穿越' },
                            { label: '意外穿越' }
                        ]
                    },
                    {
                        label: '重生类型',
                        selections: [
                            { label: '重生复仇' },
                            { label: '重生改命' },
                            { label: '重生致富' },
                            { label: '重生学霸' },
                            { label: '重生美女' },
                            { label: '重生强者' },
                            { label: '重生名人' },
                            { label: '重生亲情' },
                            { label: '重生爱情' },
                            { label: '重生事业' },
                            { label: '重生健康' },
                            { label: '重生完美' }
                        ]
                    },
                    {
                        label: '特殊穿越',
                        selections: [
                            { label: '灵魂互换' },
                            { label: '身体互换' },
                            { label: '性别互换' },
                            { label: '年龄互换' },
                            { label: '身份互换' },
                            { label: '记忆互换' },
                            { label: '能力互换' },
                            { label: '命运互换' },
                            { label: '时空循环' },
                            { label: '梦境穿越' },
                            { label: '游戏穿越' },
                            { label: '书中穿越' }
                        ]
                    },
                    {
                        label: '穿越条件',
                        selections: [
                            { label: '意外死亡' },
                            { label: '车祸穿越' },
                            { label: '溺水穿越' },
                            { label: '雷劈穿越' },
                            { label: '疾病穿越' },
                            { label: '睡觉穿越' },
                            { label: '许愿穿越' },
                            { label: '物品穿越' },
                            { label: '地点穿越' },
                            { label: '时间穿越' },
                            { label: '情感穿越' },
                            { label: '系统穿越' }
                        ]
                    }
                ]
            },
            {
                label: '系统金手指',
                selections: [
                    {
                        label: '系统类型',
                        selections: [
                            { label: '升级系统' },
                            { label: '签到系统' },
                            { label: '任务系统' },
                            { label: '商城系统' },
                            { label: '抽奖系统' },
                            { label: '学习系统' },
                            { label: '美颜系统' },
                            { label: '健康系统' },
                            { label: '财富系统' },
                            { label: '技能系统' },
                            { label: '关系系统' },
                            { label: '预测系统' }
                        ]
                    },
                    {
                        label: '特殊能力',
                        selections: [
                            { label: '透视眼' },
                            { label: '读心术' },
                            { label: '预知能力' },
                            { label: '治愈能力' },
                            { label: '控制能力' },
                            { label: '变身能力' },
                            { label: '隐身能力' },
                            { label: '飞行能力' },
                            { label: '瞬移能力' },
                            { label: '时间控制' },
                            { label: '空间能力' },
                            { label: '元素控制' }
                        ]
                    },
                    {
                        label: '金手指道具',
                        selections: [
                            { label: '神奇戒指' },
                            { label: '魔法项链' },
                            { label: '特殊手镯' },
                            { label: '古董物品' },
                            { label: '神秘盒子' },
                            { label: '魔法书籍' },
                            { label: '特殊手机' },
                            { label: '神奇眼镜' },
                            { label: '魔法镜子' },
                            { label: '特殊植物' },
                            { label: '神兽宠物' },
                            { label: '时空门' }
                        ]
                    },
                    {
                        label: '获得方式',
                        selections: [
                            { label: '系统选中' },
                            { label: '意外获得' },
                            { label: '继承获得' },
                            { label: '购买获得' },
                            { label: '捡到获得' },
                            { label: '交换获得' },
                            { label: '任务奖励' },
                            { label: '升级获得' },
                            { label: '抽奖获得' },
                            { label: '合成获得' },
                            { label: '进化获得' },
                            { label: '觉醒获得' }
                        ]
                    }
                ]
            },
            {
                label: '复仇逆袭',
                selections: [
                    {
                        label: '复仇原因',
                        selections: [
                            { label: '背叛伤害' },
                            { label: '家族仇恨' },
                            { label: '爱情背叛' },
                            { label: '事业陷害' },
                            { label: '友情背叛' },
                            { label: '亲情伤害' },
                            { label: '社会不公' },
                            { label: '权势欺压' },
                            { label: '财富掠夺' },
                            { label: '名誉损害' },
                            { label: '身体伤害' },
                            { label: '精神折磨' }
                        ]
                    },
                    {
                        label: '逆袭方式',
                        selections: [
                            { label: '智慧逆袭' },
                            { label: '财富逆袭' },
                            { label: '能力逆袭' },
                            { label: '身份逆袭' },
                            { label: '美貌逆袭' },
                            { label: '才华逆袭' },
                            { label: '人脉逆袭' },
                            { label: '机遇逆袭' },
                            { label: '努力逆袭' },
                            { label: '运气逆袭' },
                            { label: '系统逆袭' },
                            { label: '重生逆袭' }
                        ]
                    },
                    {
                        label: '身份揭秘',
                        selections: [
                            { label: '隐藏身份' },
                            { label: '多重马甲' },
                            { label: '神秘背景' },
                            { label: '真实实力' },
                            { label: '特殊能力' },
                            { label: '家族背景' },
                            { label: '财富实力' },
                            { label: '权势地位' },
                            { label: '专业技能' },
                            { label: '人际关系' },
                            { label: '过往经历' },
                            { label: '未来潜力' }
                        ]
                    },
                    {
                        label: '反转情节',
                        selections: [
                            { label: '身份反转' },
                            { label: '实力反转' },
                            { label: '关系反转' },
                            { label: '真相反转' },
                            { label: '结局反转' },
                            { label: '感情反转' },
                            { label: '立场反转' },
                            { label: '价值反转' },
                            { label: '命运反转' },
                            { label: '角色反转' },
                            { label: '情节反转' },
                            { label: '认知反转' }
                        ]
                    }
                ]
            },
            {
                label: '特殊情节',
                selections: [
                    {
                        label: '误会情节',
                        selections: [
                            { label: '身份误会' },
                            { label: '关系误会' },
                            { label: '动机误会' },
                            { label: '行为误会' },
                            { label: '话语误会' },
                            { label: '情感误会' },
                            { label: '能力误会' },
                            { label: '背景误会' },
                            { label: '目的误会' },
                            { label: '结果误会' },
                            { label: '过程误会' },
                            { label: '真相误会' }
                        ]
                    },
                    {
                        label: '巧合情节',
                        selections: [
                            { label: '偶然相遇' },
                            { label: '意外重逢' },
                            { label: '巧合救助' },
                            { label: '误打误撞' },
                            { label: '阴差阳错' },
                            { label: '命运安排' },
                            { label: '天意如此' },
                            { label: '缘分注定' },
                            { label: '机缘巧合' },
                            { label: '不期而遇' },
                            { label: '意外发现' },
                            { label: '偶然获得' }
                        ]
                    },
                    {
                        label: '危机情节',
                        selections: [
                            { label: '生命危险' },
                            { label: '财产危机' },
                            { label: '感情危机' },
                            { label: '事业危机' },
                            { label: '家庭危机' },
                            { label: '健康危机' },
                            { label: '名誉危机' },
                            { label: '法律危机' },
                            { label: '道德危机' },
                            { label: '信任危机' },
                            { label: '选择危机' },
                            { label: '时间危机' }
                        ]
                    }
                ]
            }
        ]
    },
    {
        label: '题材风格',
        selections: [
            {
                label: '动作冒险',
                selections: [
                    {
                        label: '动作类型',
                        selections: [
                            { label: '武打动作' },
                            { label: '枪战动作' },
                            { label: '爆炸场面' },
                            { label: '追车场面' },
                            { label: '格斗比赛' },
                            { label: '军事行动' },
                            { label: '特工任务' },
                            { label: '警匪追击' },
                            { label: '复仇行动' },
                            { label: '救援行动' },
                            { label: '冒险探索' },
                            { label: '极限运动' }
                        ]
                    },
                    {
                        label: '冒险探索',
                        selections: [
                            { label: '宝藏寻找' },
                            { label: '遗迹探索' },
                            { label: '荒野求生' },
                            { label: '深海探险' },
                            { label: '太空探索' },
                            { label: '地心探险' },
                            { label: '考古发现' },
                            { label: '科学探索' },
                            { label: '未知领域' },
                            { label: '危险地带' },
                            { label: '神秘事件' },
                            { label: '超自然现象' }
                        ]
                    },
                    {
                        label: '历史军事',
                        selections: [
                            { label: '古代战争' },
                            { label: '现代战争' },
                            { label: '未来战争' },
                            { label: '抗日战争' },
                            { label: '解放战争' },
                            { label: '朝鲜战争' },
                            { label: '越南战争' },
                            { label: '海湾战争' },
                            { label: '特种部队' },
                            { label: '间谍活动' },
                            { label: '军事科技' },
                            { label: '战争英雄' }
                        ]
                    },
                    {
                        label: '竞技体育',
                        selections: [
                            { label: '足球' },
                            { label: '篮球' },
                            { label: '网球' },
                            { label: '游泳' },
                            { label: '田径' },
                            { label: '体操' },
                            { label: '武术' },
                            { label: '拳击' },
                            { label: '赛车' },
                            { label: '极限运动' },
                            { label: '电子竞技' },
                            { label: '棋类运动' }
                        ]
                    }
                ]
            },
            {
                label: '轻松娱乐',
                selections: [
                    {
                        label: '喜剧搞笑',
                        selections: [
                            { label: '无厘头喜剧' },
                            { label: '情景喜剧' },
                            { label: '黑色幽默' },
                            { label: '讽刺喜剧' },
                            { label: '浪漫喜剧' },
                            { label: '家庭喜剧' },
                            { label: '职场喜剧' },
                            { label: '校园喜剧' },
                            { label: '古装喜剧' },
                            { label: '科幻喜剧' },
                            { label: '动作喜剧' },
                            { label: '音乐喜剧' }
                        ]
                    },
                    {
                        label: '二次元',
                        selections: [
                            { label: '动漫改编' },
                            { label: '游戏改编' },
                            { label: '漫画改编' },
                            { label: '轻小说改编' },
                            { label: '同人作品' },
                            { label: '原创动漫' },
                            { label: 'ACG文化' },
                            { label: '宅文化' },
                            { label: '萌文化' },
                            { label: '腐文化' },
                            { label: '百合文化' },
                            { label: '偶像文化' }
                        ]
                    },
                    {
                        label: '娱乐圈',
                        selections: [
                            { label: '明星生活' },
                            { label: '经纪人' },
                            { label: '导演制片' },
                            { label: '编剧作家' },
                            { label: '歌手音乐' },
                            { label: '模特时尚' },
                            { label: '网红主播' },
                            { label: '综艺节目' },
                            { label: '选秀比赛' },
                            { label: '娱乐记者' },
                            { label: '粉丝文化' },
                            { label: '娱乐产业' }
                        ]
                    },
                    {
                        label: '生活情趣',
                        selections: [
                            { label: '美食文化' },
                            { label: '旅游度假' },
                            { label: '宠物生活' },
                            { label: '园艺种植' },
                            { label: '手工制作' },
                            { label: '收藏爱好' },
                            { label: '摄影艺术' },
                            { label: '音乐艺术' },
                            { label: '书画艺术' },
                            { label: '文学创作' },
                            { label: '时尚穿搭' },
                            { label: '居家生活' }
                        ]
                    }
                ]
            },
            {
                label: '深度题材',
                selections: [
                    {
                        label: '宫斗权谋',
                        selections: [
                            { label: '后宫争斗' },
                            { label: '朝堂政治' },
                            { label: '权力游戏' },
                            { label: '阴谋阳谋' },
                            { label: '联盟背叛' },
                            { label: '利益纠葛' },
                            { label: '政治联姻' },
                            { label: '权力传承' },
                            { label: '改革变法' },
                            { label: '外交斗争' },
                            { label: '军事政治' },
                            { label: '经济政治' }
                        ]
                    },
                    {
                        label: '商战职场',
                        selections: [
                            { label: '企业竞争' },
                            { label: '商业谈判' },
                            { label: '市场争夺' },
                            { label: '技术竞争' },
                            { label: '人才争夺' },
                            { label: '资本运作' },
                            { label: '并购重组' },
                            { label: '创业投资' },
                            { label: '国际贸易' },
                            { label: '金融投资' },
                            { label: '房地产' },
                            { label: '互联网' }
                        ]
                    },
                    {
                        label: '传承文化',
                        selections: [
                            { label: '非遗传承' },
                            { label: '传统工艺' },
                            { label: '民族文化' },
                            { label: '地方文化' },
                            { label: '家族传承' },
                            { label: '师徒传承' },
                            { label: '文化复兴' },
                            { label: '文化保护' },
                            { label: '文化创新' },
                            { label: '文化产业' },
                            { label: '文化教育' },
                            { label: '文化交流' }
                        ]
                    },
                    {
                        label: '社会议题',
                        selections: [
                            { label: '环保议题' },
                            { label: '教育问题' },
                            { label: '医疗改革' },
                            { label: '养老问题' },
                            { label: '就业问题' },
                            { label: '住房问题' },
                            { label: '贫富差距' },
                            { label: '社会公平' },
                            { label: '法律正义' },
                            { label: '道德伦理' },
                            { label: '科技伦理' },
                            { label: '人工智能' }
                        ]
                    }
                ]
            }
        ]
    },
    {
        label: '特殊分类',
        selections: [
            {
                label: '科幻未来',
                selections: [
                    {
                        label: '科幻题材',
                        selections: [
                            { label: '太空歌剧' },
                            { label: '时间旅行' },
                            { label: '平行宇宙' },
                            { label: '人工智能' },
                            { label: '机器人' },
                            { label: '克隆人' },
                            { label: '基因改造' },
                            { label: '虚拟现实' },
                            { label: '赛博朋克' },
                            { label: '蒸汽朋克' },
                            { label: '生物朋克' },
                            { label: '太阳朋克' }
                        ]
                    },
                    {
                        label: '末世题材',
                        selections: [
                            { label: '丧尸末世' },
                            { label: '病毒末世' },
                            { label: '核战末世' },
                            { label: '气候末世' },
                            { label: '外星入侵' },
                            { label: '机器叛乱' },
                            { label: '资源枯竭' },
                            { label: '环境污染' },
                            { label: '社会崩溃' },
                            { label: '文明倒退' },
                            { label: '人类变异' },
                            { label: '末世重建' }
                        ]
                    },
                    {
                        label: '星际题材',
                        selections: [
                            { label: '星际战争' },
                            { label: '星际探索' },
                            { label: '星际贸易' },
                            { label: '星际殖民' },
                            { label: '外星文明' },
                            { label: '星际联盟' },
                            { label: '银河帝国' },
                            { label: '太空海盗' },
                            { label: '星际流浪' },
                            { label: '星际恋情' },
                            { label: '星际政治' },
                            { label: '星际科技' }
                        ]
                    },
                    {
                        label: '超自然',
                        selections: [
                            { label: '超能力者' },
                            { label: '变种人' },
                            { label: '异能觉醒' },
                            { label: '超自然现象' },
                            { label: '平行世界' },
                            { label: '时空异常' },
                            { label: '维度穿越' },
                            { label: '量子世界' },
                            { label: '精神世界' },
                            { label: '梦境世界' },
                            { label: '灵魂世界' },
                            { label: '意识世界' }
                        ]
                    }
                ]
            },
            {
                label: '多元关系',
                selections: [
                    {
                        label: '复杂关系',
                        selections: [
                            { label: '多角恋情' },
                            { label: '三角关系' },
                            { label: '四角关系' },
                            { label: '群体关系' },
                            { label: '网状关系' },
                            { label: '循环关系' },
                            { label: '对立关系' },
                            { label: '竞争关系' },
                            { label: '合作关系' },
                            { label: '依赖关系' },
                            { label: '互补关系' },
                            { label: '平衡关系' }
                        ]
                    },
                    {
                        label: '特殊关系',
                        selections: [
                            { label: '师生恋' },
                            { label: '医患恋' },
                            { label: '上下级恋' },
                            { label: '主仆恋' },
                            { label: '保镖恋' },
                            { label: '明星粉丝' },
                            { label: '作家读者' },
                            { label: '房东房客' },
                            { label: '邻居恋' },
                            { label: '网友恋' },
                            { label: '笔友恋' },
                            { label: '游戏恋' }
                        ]
                    },
                    {
                        label: '年龄差恋',
                        selections: [
                            { label: '姐弟恋' },
                            { label: '师生恋' },
                            { label: '忘年恋' },
                            { label: '代沟恋' },
                            { label: '跨代恋' },
                            { label: '老夫少妻' },
                            { label: '少夫老妻' },
                            { label: '同龄恋' },
                            { label: '童年恋' },
                            { label: '青春恋' },
                            { label: '中年恋' },
                            { label: '老年恋' }
                        ]
                    },
                    {
                        label: '身份差恋',
                        selections: [
                            { label: '贫富差距' },
                            { label: '地位悬殊' },
                            { label: '职业差异' },
                            { label: '教育差异' },
                            { label: '文化差异' },
                            { label: '国籍差异' },
                            { label: '种族差异' },
                            { label: '宗教差异' },
                            { label: '价值观差异' },
                            { label: '生活方式差异' },
                            { label: '家庭背景差异' },
                            { label: '成长环境差异' }
                        ]
                    }
                ]
            },
            {
                label: '其他特色',
                selections: [
                    {
                        label: '美食生活',
                        selections: [
                            { label: '厨师料理' },
                            { label: '美食家' },
                            { label: '餐厅经营' },
                            { label: '食材寻找' },
                            { label: '烹饪比赛' },
                            { label: '美食旅行' },
                            { label: '传统美食' },
                            { label: '创新料理' },
                            { label: '街头小吃' },
                            { label: '高级料理' },
                            { label: '家常菜' },
                            { label: '节庆美食' }
                        ]
                    },
                    {
                        label: '医疗题材',
                        selections: [
                            { label: '医生护士' },
                            { label: '医院生活' },
                            { label: '疾病治疗' },
                            { label: '医学研究' },
                            { label: '医疗改革' },
                            { label: '医患关系' },
                            { label: '医疗事故' },
                            { label: '医疗伦理' },
                            { label: '急诊科' },
                            { label: '手术室' },
                            { label: '儿科' },
                            { label: '妇产科' }
                        ]
                    },
                    {
                        label: '教育题材',
                        selections: [
                            { label: '学校生活' },
                            { label: '师生关系' },
                            { label: '教育改革' },
                            { label: '应试教育' },
                            { label: '素质教育' },
                            { label: '特殊教育' },
                            { label: '职业教育' },
                            { label: '成人教育' },
                            { label: '家庭教育' },
                            { label: '社会教育' },
                            { label: '在线教育' },
                            { label: '国际教育' }
                        ]
                    },
                    {
                        label: '法律题材',
                        selections: [
                            { label: '律师生活' },
                            { label: '法庭审判' },
                            { label: '法律援助' },
                            { label: '司法改革' },
                            { label: '法律伦理' },
                            { label: '犯罪预防' },
                            { label: '受害者保护' },
                            { label: '法律教育' },
                            { label: '法律服务' },
                            { label: '国际法' },
                            { label: '商法' },
                            { label: '刑法' }
                        ]
                    },
                    {
                        label: '心理题材',
                        selections: [
                            { label: '心理咨询' },
                            { label: '心理治疗' },
                            { label: '心理疾病' },
                            { label: '心理健康' },
                            { label: '心理成长' },
                            { label: '心理创伤' },
                            { label: '心理康复' },
                            { label: '心理分析' },
                            { label: '心理测试' },
                            { label: '心理干预' },
                            { label: '心理教育' },
                            { label: '心理研究' }
                        ]
                    }
                ]
            }
        ]
    }
];

// Helper function to convert old nested object format to new recursive format
function convertToRecursive(data: any): GenreSelection[] {
    if (Array.isArray(data)) {
        // If it's an array, convert each item to a leaf node
        return data.map(item => ({ label: item }));
    }

    if (typeof data === 'object' && data !== null) {
        // If it's an object, convert each key-value pair
        return Object.entries(data).map(([key, value]) => ({
            label: key,
            selections: convertToRecursive(value)
        }));
    }

    return [];
}

// Original genre data (we'll expand this piece by piece)
const originalGenreData = {
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

// Convert to recursive structure
export const genreOptions: GenreSelection[] = convertToRecursive(originalGenreData); 