import { DomainFilter } from './types';

export const DOMAINS: DomainFilter[] = [
  {
    id: 'cs',
    label: 'Computer Science',
    categories: [
      {
        type: 'Conference',
        items: [
          // AI / ML
          { id: 'neurips', name: 'NeurIPS (Neural Information Processing Systems)' },
          { id: 'icml', name: 'ICML (International Conference on Machine Learning)' },
          { id: 'iclr', name: 'ICLR (International Conference on Learning Representations)' },
          { id: 'aaai', name: 'AAAI (Association for the Advancement of Artificial Intelligence)' },
          { id: 'ijcai', name: 'IJCAI (International Joint Conference on Artificial Intelligence)' },
          { id: 'uai', name: 'UAI (Conference on Uncertainty in Artificial Intelligence)' },
          // NLP
          { id: 'acl', name: 'ACL (Association for Computational Linguistics)' },
          { id: 'emnlp', name: 'EMNLP (Empirical Methods in Natural Language Processing)' },
          { id: 'naacl', name: 'NAACL (North American Chapter of the ACL)' },
          // CV
          { id: 'cvpr', name: 'CVPR (Computer Vision and Pattern Recognition)' },
          { id: 'iccv', name: 'ICCV (International Conference on Computer Vision)' },
          { id: 'eccv', name: 'ECCV (European Conference on Computer Vision)' },
          // Data / Web
          { id: 'kdd', name: 'KDD (Knowledge Discovery and Data Mining)' },
          { id: 'www', name: 'WWW (The Web Conference)' },
          { id: 'sigir', name: 'SIGIR (Special Interest Group on Information Retrieval)' },
          // DB
          { id: 'sigmod', name: 'SIGMOD (Special Interest Group on Management of Data)' },
          { id: 'vldb', name: 'VLDB (Very Large Data Bases)' },
          // Systems
          { id: 'sosp', name: 'SOSP (Symposium on Operating Systems Principles)' },
          { id: 'osdi', name: 'OSDI (Operating Systems Design and Implementation)' },
          { id: 'nsdi', name: 'NSDI (Networked Systems Design and Implementation)' },
          { id: 'asplos', name: 'ASPLOS (Arch. Support for Programming Lang. and OS)' },
          // Networking
          { id: 'sigcomm', name: 'SIGCOMM (Special Interest Group on Data Communication)' },
          // Security
          { id: 'sp', name: 'IEEE S&P (Symposium on Security and Privacy)' },
          { id: 'usenixsec', name: 'USENIX Security (USENIX Security Symposium)' },
          { id: 'ccs', name: 'ACM CCS (Conf. on Computer and Communications Security)' },
          // SE / HCI / PL
          { id: 'icse', name: 'ICSE (International Conference on Software Engineering)' },
          { id: 'chi', name: 'CHI (Conference on Human Factors in Computing Systems)' },
          { id: 'popl', name: 'POPL (Principles of Programming Languages)' },
          { id: 'pldi', name: 'PLDI (Programming Language Design and Implementation)' },
          // Theory / Graphics / Robotics
          { id: 'stoc', name: 'STOC (Symposium on Theory of Computing)' },
          { id: 'focs', name: 'FOCS (Foundations of Computer Science)' },
          { id: 'siggraph', name: 'SIGGRAPH (Special Interest Group on Computer Graphics)' },
          { id: 'icra', name: 'ICRA (International Conference on Robotics and Automation)' }
        ]
      },
      {
        type: 'Journal',
        items: [
          { id: 'nature-science', name: 'N/S (Nature / Science Portfolio)' }
        ]
      }
    ]
  },
  {
    id: 'business',
    label: 'Business & Management',
    categories: [
      {
        type: 'Conference',
        items: [
          { id: 'aom', name: 'AOM (Academy of Management Annual Meeting)' }
        ]
      },
      {
        type: 'Journal',
        items: [
          // Accounting
          { id: 'tar', name: 'TAR (The Accounting Review)' },
          { id: 'jae', name: 'JAE (Journal of Accounting and Economics)' },
          { id: 'jar', name: 'JAR (Journal of Accounting Research)' },
          // Finance
          { id: 'jf', name: 'JF (Journal of Finance)' },
          { id: 'jfe', name: 'JFE (Journal of Financial Economics)' },
          { id: 'rfs', name: 'RFS (Review of Financial Studies)' },
          // Info Systems
          { id: 'isr', name: 'ISR (Information Systems Research)' },
          { id: 'misq', name: 'MISQ (MIS Quarterly)' },
          { id: 'joc', name: 'JOC (INFORMS Journal on Computing)' },
          // Marketing
          { id: 'jm', name: 'JM (Journal of Marketing)' },
          { id: 'jmr', name: 'JMR (Journal of Marketing Research)' },
          { id: 'jcr', name: 'JCR (Journal of Consumer Research)' },
          { id: 'mksci', name: 'MKSCI (Marketing Science)' },
          // Management / Operations
          { id: 'mgtsci', name: 'MgtSci (Management Science)' },
          { id: 'or', name: 'OR (Operations Research)' },
          { id: 'jom', name: 'JOM (Journal of Operations Management)' },
          { id: 'msom', name: 'MSOM (Manufacturing & Service Operations Management)' },
          { id: 'pom', name: 'POM (Production and Operations Management)' },
          // Strategy / General
          { id: 'amj', name: 'AMJ (Academy of Management Journal)' },
          { id: 'amr', name: 'AMR (Academy of Management Review)' },
          { id: 'asq', name: 'ASQ (Administrative Science Quarterly)' },
          { id: 'orgsci', name: 'OrgSci (Organization Science)' },
          { id: 'jibs', name: 'JIBS (Journal of International Business Studies)' },
          { id: 'smj', name: 'SMJ (Strategic Management Journal)' },
          // Economics (FT50)
          { id: 'aer', name: 'AER (American Economic Review)' },
          { id: 'econometrica', name: 'Econometrica (Econometrica)' },
          { id: 'qje', name: 'QJE (The Quarterly Journal of Economics)' }
        ]
      }
    ]
  }
];

export const MAX_FREE_TRIALS = 3;  // 匿名用户配额
export const MAX_FREE_USER_QUOTA = 50;  // 注册用户（free plan）配额