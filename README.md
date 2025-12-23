# ScholarPulse - Paper Finder

A simplified paper search application that finds academic papers from elite venues.

## Setup

### Backend

1. Create and activate conda environment:
```bash
conda create -n paper python=3.10
conda activate paper
```

2. Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

3. Run the backend server:
```bash
python server.py
```

The backend will run on `http://localhost:8000`

### Frontend

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Run the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Usage

1. Open the application in your browser
2. Enter your search query (e.g., "causal inference")
3. Select the venues and year range from the sidebar
4. Click the send button to search
5. Results will be displayed as a list with:
   - Paper title (clickable link)
   - Venue
   - Year

## Supported Venues

### Computer Science Conferences
- **AI/ML**: NeurIPS, ICML, ICLR, AAAI, IJCAI, UAI
- **NLP**: ACL, EMNLP, NAACL, COLING
- **Computer Vision**: CVPR, ICCV, ECCV
- **Data Mining**: KDD, WWW, SIGIR
- **Databases**: SIGMOD, VLDB
- **Systems**: SOSP, OSDI, NSDI, ASPLOS
- **Networking**: SIGCOMM
- **Security**: IEEE S&P, USENIX Security, ACM CCS
- **Software Engineering**: ICSE
- **HCI**: CHI
- **Programming Languages**: POPL, PLDI
- **Theory**: STOC, FOCS
- **Graphics**: SIGGRAPH
- **Robotics**: ICRA

### Business & Management Journals
- **Accounting**: TAR, JAE, JAR
- **Finance**: JF, JFE, RFS
- **Information Systems**: ISR, MISQ, JOC
- **Marketing**: JM, JMR, JCR, MKSCI
- **Management**: MgtSci, OR, JOM, MSOM, POM
- **Strategy**: AMJ, AMR, ASQ, OrgSci, JIBS, SMJ
- **Economics**: AER, Econometrica, QJE
- **General**: Nature/Science

## Backend API

The backend provides a `/search` endpoint that accepts POST requests with:
- `query`: search keywords
- `venues`: list of venues to search (optional, searches all if not provided)
- `startYear`: start year
- `endYear`: end year

The backend uses CrossRef and Semantic Scholar APIs to find papers.
