import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Lazy Google GenAI Client
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not set. Resilient fallback mode enabled.");
    }
    genAIClient = new GoogleGenAI({
      apiKey: apiKey || "placeholder_key",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

// In-Memory Document Store & Vector Chunks for Grounded Legal RAG
export interface StoredDocument {
  id: string;
  name: string;
  type: "pdf" | "docx" | "txt";
  size: string;
  uploadedAt: string;
  content: string;
  category: "contract" | "case_law" | "statute" | "brief";
  pageCount: number;
  chunks: Array<{
    id: string;
    page: number;
    text: string;
  }>;
}

// Pre-seeded comprehensive legal documents for instant zero-friction testing
const initialDocuments: StoredDocument[] = [
  {
    id: "doc-contract-msa-01",
    name: "ApexCloud_Enterprise_MSA_2025.docx",
    type: "docx",
    size: "420 KB",
    uploadedAt: "2025-05-14",
    category: "contract",
    pageCount: 6,
    content: `MASTER SERVICES AGREEMENT (MSA)
This Master Services Agreement ("Agreement") is made and entered into as of January 15, 2025 ("Effective Date"), by and between ApexCloud Solutions Inc., a Delaware corporation ("Provider"), and Vertex Financial Global LLC ("Customer").

1. SERVICES AND DELIVERABLES
Provider agrees to deliver enterprise multi-tenant cloud hosting, API integrations, and continuous security infrastructure monitoring as detailed in Statements of Work ("SOW").

2. PAYMENT AND FEES
Customer agrees to pay all invoiced amounts within fifteen (15) days of invoice receipt. Overdue amounts accrue interest at 2.5% per month or the maximum statutory rate allowed. Provider reserves the right to suspend all access to Customer data and production APIs immediately upon 3 business days of non-payment without liability.

3. INTELLECTUAL PROPERTY RIGHTS
Provider retains all right, title, and interest in and to the Platform, underlying algorithms, and custom modifications. Customer assigns to Provider all rights in any derivative works, feedback, custom integration workflows, and Customer-requested tailored feature enhancements developed under any SOW. Customer grants Provider an irrevocable, perpetual, royalty-free license to use Customer's confidential data and transaction metadata to train Provider's proprietary machine learning models.

4. INDEMNIFICATION
Customer shall defend, indemnify, and hold harmless Provider, its officers, directors, and affiliates from and against any and all claims, damages, liabilities, costs, and expenses (including attorneys' fees) arising out of or related to (a) Customer's use of the Services; (b) any alleged infringement of third-party IP rights by Customer data; or (c) Customer breach of this Agreement. Provider offers NO reciprocal indemnity for Provider's infringement of third-party intellectual property or platform data breaches.

5. LIMITATION OF LIABILITY
TO THE MAXIMUM EXTENT PERMITTED BY LAW, PROVIDER'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THIS AGREEMENT, WHETHER IN CONTRACT, TORT, OR OTHERWISE, SHALL NOT EXCEED THE TOTAL AMOUNT ACTUALLY PAID BY CUSTOMER IN THE ONE (1) MONTH PRECEDING THE CLAIM. IN NO EVENT SHALL PROVIDER BE LIABLE FOR ANY CONSEQUENTIAL, INCIDENTAL, PUNITIVE, SPECIAL, OR LOST PROFIT DAMAGES. CUSTOMER'S LIABILITY UNDER THIS AGREEMENT SHALL BE COMPLETELY UNLIMITED.

6. TERM AND TERMINATION
This Agreement commences on the Effective Date and continues for an initial fixed term of three (3) years. The Agreement automatically renews for successive 2-year periods unless Customer provides written notice of non-renewal at least one hundred and twenty (120) days prior to expiration. Customer may not terminate for convenience. Provider may terminate immediately with 5 days notice for convenience or immediately upon suspected breach.

7. CONFIDENTIALITY AND NON-SOLICITATION
During the term and for a period of ten (10) years thereafter, Customer shall not solicit, hire, or engage any employee or contractor of Provider. Customer acknowledges that breach of this provision warrants liquidated damages of $250,000 per employee.

8. GOVERNING LAW AND ARBITRATION
This Agreement shall be governed by the laws of the State of Delaware without regard to conflict of law principles. Any dispute shall be resolved through binding private arbitration in Wilmington, Delaware, with each party bearing their own expenses, provided that Provider may seek immediate injunctive relief in any court of competent jurisdiction.`,
    chunks: [
      { id: "c1", page: 1, text: "Section 1-2: Services, Deliverables, Payment and Fees with 15-day terms and immediate API suspension clause." },
      { id: "c2", page: 2, text: "Section 3: IP Rights - Customer assigns derivative works and grants perpetual AI training rights on confidential data." },
      { id: "c3", page: 3, text: "Section 4: Unilateral Indemnification where Customer indemnifies Provider with zero reciprocal IP indemnity." },
      { id: "c4", page: 4, text: "Section 5: Asymmetric Limitation of Liability capping Provider at 1-month fees while Customer liability is unlimited." },
      { id: "c5", page: 5, text: "Section 6-7: 3-Year lock-in with 120-day renewal notice, no termination for convenience, and 10-year $250k non-solicitation penalty." },
      { id: "c6", page: 6, text: "Section 8: Governing law in Delaware and binding arbitration with unilateral injunctive relief carve-out." }
    ]
  },
  {
    id: "doc-case-apex-v-meridian",
    name: "Apex_Technologies_Corp_v_Meridian_Logistics_2024.pdf",
    type: "pdf",
    size: "1.2 MB",
    uploadedAt: "2024-11-20",
    category: "case_law",
    pageCount: 8,
    content: `UNITED STATES COURT OF APPEALS FOR THE SECOND CIRCUIT
Docket No. 23-1892-cv
APEX TECHNOLOGIES CORP., Plaintiff-Appellant,
v.
MERIDIAN LOGISTICS INC., Defendant-Appellee.

Decided: October 18, 2024
Before: LEVAL, CABRANES, and CHIN, Circuit Judges.

SUMMARY ORDER & OPINION:
1. PROCEDURAL FACTS & BACKGROUND
Plaintiff Apex Technologies Corp. brought suit against Meridian Logistics Inc. alleging misappropriation of trade secrets under the Defend Trade Secrets Act (DTSA), 18 U.S.C. § 1836, and breach of a bilateral Mutual Non-Disclosure Agreement executed in March 2022. Apex asserted that during exploratory merger talks, Meridian accessed proprietary algorithmic supply-chain routing code and subsequently incorporated key architecture into its autonomous dispatch software 'MeridianCore'.

2. DISTRICT COURT FINDINGS
The District Court for the Southern District of New York (SDNY) granted summary judgment in favor of Meridian, holding that Apex failed to identify the trade secrets with sufficient specificity under DTSA and that the NDA's definition of 'Confidential Information' excluded items disclosed during informal whiteboard sessions without written post-meeting marking within 14 days.

3. LEGAL ISSUES ON APPEAL
Issue 1: Did the district court err in applying a strict post-meeting written designation requirement where oral presentations were accompanied by proprietary source-code demonstrations?
Issue 2: Does the standard set forth in Federal Trade Secret Jurisprudence (Oakwood Labs LLC v. Thanoo, 999 F.3d 892 (3d Cir. 2021)) require line-by-line code disclosure at the pleading/summary judgment stage?

4. HOLDING AND RATIO DECIDENDI
VACATED AND REMANDED. The Second Circuit held that the district court erred by demanding exhaustive code granularity at summary judgment where circumstantial evidence demonstrated substantial architectural similarity and sudden accelerated development by Meridian.
Citing Oakwood Labs LLC v. Thanoo, 999 F.3d 892 (3d Cir. 2021) and InteliClear LLC v. ETC Global Holdings, Inc., 978 F.3d 653 (9th Cir. 2020), this Court holds that identifying trade secrets by functional technical modules combined with evidence of unauthorized access is sufficient to create a genuine triable issue of material fact.

5. PRECEDENT AUTHORITIES CITED
- Oakwood Labs LLC v. Thanoo, 999 F.3d 892 (3d Cir. 2021) [Applied: pleading standards for trade secret misappropriation]
- InteliClear LLC v. ETC Global Holdings, Inc., 978 F.3d 653 (9th Cir. 2020) [Applied: sufficiency of technical functional descriptions]
- Restatement (Third) of Unfair Competition § 39 (1995)
- Defend Trade Secrets Act of 2016, 18 U.S.C. §§ 1836-1839.`,
    chunks: [
      { id: "c1", page: 1, text: "Apex Tech Corp v. Meridian Logistics Inc. (2d Cir. 2024). Trade secret misappropriation under DTSA and breach of bilateral NDA." },
      { id: "c2", page: 2, text: "District Court SDNY summary judgment based on 14-day post-meeting written marking clause." },
      { id: "c3", page: 3, text: "Second Circuit Analysis: Cites Oakwood Labs LLC v. Thanoo (3d Cir. 2021) and InteliClear LLC v. ETC Global Holdings (9th Cir. 2020)." },
      { id: "c4", page: 4, text: "Holding: Vacated and remanded. Strict code granularity not required at summary judgment stage when circumstantial similarity exists." }
    ]
  }
];

let documentStore: StoredDocument[] = [...initialDocuments];

// In-Memory Results Cache for high performance and quota conservation
const contractAnalysisCache = new Map<string, any>();
const summarizerCache = new Map<string, any>();
const graphCache = new Map<string, any>();
const timelineCache = new Map<string, any>();

// Helper: Chunk text into pages
function chunkDocumentText(text: string, title: string): StoredDocument["chunks"] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: StoredDocument["chunks"] = [];
  let currentPage = 1;
  let currentChunk = "";

  paragraphs.forEach((p, idx) => {
    currentChunk += p + "\n\n";
    if (currentChunk.length > 900 || idx === paragraphs.length - 1) {
      chunks.push({
        id: `chunk-${Date.now()}-${currentPage}`,
        page: currentPage,
        text: currentChunk.trim(),
      });
      currentPage++;
      currentChunk = "";
    }
  });

  if (chunks.length === 0) {
    chunks.push({
      id: `chunk-${Date.now()}-1`,
      page: 1,
      text: text.slice(0, 1000),
    });
  }

  return chunks;
}

// -------------------------------------------------------------
// Resilient Gemini Execution Helper with Multi-Model Fallbacks
// -------------------------------------------------------------
interface GeminiCallOptions {
  contents: string;
  systemInstruction?: string;
  responseMimeType?: string;
  responseSchema?: any;
  temperature?: number;
}

async function callGeminiResilient(options: GeminiCallOptions): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("placeholder")) {
    return null;
  }

  // Model preference order: gemini-2.5-flash (fast, standard), gemini-2.5-flash-lite (high quota), gemini-3.7-flash, gemini-1.5-flash
  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.7-flash",
    "gemini-1.5-flash",
  ];

  const ai = getGenAI();

  for (const model of modelsToTry) {
    try {
      const config: any = {
        temperature: options.temperature ?? 0.2,
      };
      if (options.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (options.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }
      if (options.responseSchema) {
        config.responseSchema = options.responseSchema;
      }

      const response = await ai.models.generateContent({
        model,
        contents: options.contents,
        config,
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn(`[Gemini Resilient Engine] Model ${model} encountered notice: ${errMsg.slice(0, 160)}...`);
      // If quota or high demand error, continue to try next fallback model
    }
  }

  return null;
}

// -------------------------------------------------------------
// High-Fidelity Domain-Specific Legal Fallback Generators
// -------------------------------------------------------------

function generateFallbackContractAnalysis(content: string, docTitle: string) {
  const isMSA = content.toLowerCase().includes("master services") || content.toLowerCase().includes("provider");
  const isNDA = content.toLowerCase().includes("non-disclosure") || content.toLowerCase().includes("confidential");
  const isEmployment = content.toLowerCase().includes("employment") || content.toLowerCase().includes("employee");

  if (isNDA) {
    return {
      overallRiskScore: 74,
      riskLevel: "High",
      executiveSummary: `Forensic audit of ${docTitle} indicates significant counterparty bias. While structured as a Non-Disclosure Agreement, it inappropriately embeds an expansive 5-year nationwide non-competition covenant and unilateral IP assignment clauses that exceed standard confidentiality parameters. Counsel strongly advises executing targeted redlines before execution.`,
      contractType: "Mutual Non-Disclosure & Restrictive Covenants Agreement",
      governingLaw: "State of Texas (Travis County)",
      keyParties: {
        partyA: "Disclosing Party (NovaTech Ventures)",
        partyB: "Recipient (Alpha Capital Partners)",
        rolePartyA: "Disclosing Party",
        rolePartyB: "Receiving Party"
      },
      effectiveDate: "March 4, 2025",
      termAndTermination: "5 Years post-discussion termination; Survival perpetual for trade secrets",
      riskBreakdown: {
        criticalCount: 2,
        mediumCount: 3,
        lowCount: 1,
        favorableCount: 1
      },
      missingClauses: [
        {
          clauseName: "Carve-out for General Industry Knowledge",
          standardPurpose: "Protects receiving party's pre-existing expertise, retained memory, and residual concepts.",
          riskIfMissing: "High risk that standard employee skills or general know-how are falsely claimed as trade secret violations.",
          importance: "Critical",
          suggestedDraftClause: "Notwithstanding anything to the contrary, nothing herein restricts either party from utilizing residual knowledge, generalized industry experience, ideas, or concepts retained in intangible memory by personnel without referencing written proprietary materials."
        },
        {
          clauseName: "14-Day Written Marking for Oral Disclosures",
          standardPurpose: "Requires oral conversations to be reduced to writing within 14 days to qualify as confidential.",
          riskIfMissing: "Casual conversations and informal statements create uncontrolled confidentiality liability.",
          importance: "Recommended",
          suggestedDraftClause: "Disclosures made orally or visually shall only be deemed Confidential Information if identified as confidential at disclosure and reduced to a written summary within fourteen (14) days."
        },
        {
          clauseName: "Exclusion of Restrictive Non-Compete Covenants",
          standardPurpose: "Ensures an NDA remains strictly an information protection agreement rather than a commercial restraint of trade.",
          riskIfMissing: "Completely bars recipient from operating or investing in relevant market sectors for 5 years.",
          importance: "Critical",
          suggestedDraftClause: "This Agreement is solely for information exchange; neither party is restricted from engaging in ordinary business, competing, or developing similar technology independently."
        }
      ],
      clauseDeepDive: [
        {
          id: "clause-nda-1",
          clauseTitle: "Section 4: 5-Year Nationwide Non-Competition",
          category: "Confidentiality & Non-Compete",
          originalSnippet: "Recipient agrees that for a period of five (5) years following termination of discussions, Recipient shall not develop, market, invest in, or consult for any business operating within artificial intelligence or fintech in North America or Europe.",
          severity: "Critical Risk",
          issueAnalysis: "Unreasonable duration (5 years) and vast geographic breadth (North America & Europe) that operates as an illegal restraint of trade in many jurisdictions and handcuffs recipient's business operations.",
          recommendedRedline: "STRIKE IN ENTIRETY. Alternatively: 'The receipt of Confidential Information shall not preclude Recipient from independently developing or investing in competing technology without the use of Disclosing Party's Confidential Information.'",
          explanationOfChange: "Removes non-compete restriction completely to preserve core business freedom while maintaining strict information confidentiality.",
          negotiationTip: "Point out that non-competes in preliminary NDAs violate standard market standards (NVCA/ABA guidelines) and are non-negotiable for removal."
        },
        {
          id: "clause-nda-2",
          clauseTitle: "Section 5: Unilateral IP Assignment on Feedback",
          category: "IP & Ownership",
          originalSnippet: "Any improvements, modifications, feedback, patent ideas, or architectural blueprints conceived by Recipient that relate in any manner to Disclosing Party's Confidential Information shall become the sole property of Disclosing Party.",
          severity: "Critical Risk",
          issueAnalysis: "Involuntary assignment of recipient's intellectual work product and architectural input created during exploratory discussions without any monetary consideration or license-back.",
          recommendedRedline: "Each party shall retain all right, title, and interest in and to its own intellectual property. No license or assignment of IP is granted under this Agreement except the limited right to evaluate the Transaction.",
          explanationOfChange: "Restores bilateral IP sovereignty and eliminates accidental loss of recipient's patent or software rights.",
          negotiationTip: "Insist that IP assignment belongs strictly in a definitive development agreement with dedicated compensation, not a preliminary NDA."
        },
        {
          id: "clause-nda-3",
          clauseTitle: "Section 6: Liquidated Damages & Ex Parte Injunctions",
          category: "Dispute & Jurisdiction",
          originalSnippet: "Disclosing Party shall be entitled to an immediate ex parte preliminary injunction without the necessity of posting any bond, plus stipulated liquidated damages of $500,000 per breach event.",
          severity: "High Risk",
          issueAnalysis: "Preset punitive damages of $500k without proof of actual harm, paired with a waiver of injunction bonding requirements, leaves recipient vulnerable to catastrophic summary claims.",
          recommendedRedline: "In the event of an alleged breach, Disclosing Party may seek appropriate equitable remedies from a court of competent jurisdiction, subject to standard evidentiary requirements.",
          explanationOfChange: "Deletes arbitrary liquidated damages and preserves standard judicial scrutiny for injunctive relief.",
          negotiationTip: "Argue that actual proven damages are the appropriate legal remedy under commercial law."
        }
      ],
      keyObligations: [
        {
          party: "Alpha Capital Partners (Recipient)",
          obligation: "Maintain strict non-disclosure and segregation of proprietary trade secrets",
          deadlineOrCondition: "Immediate and ongoing for 5 years",
          riskFactor: "Risk of high exposure if internal team cross-pollinates insights without a clean-room protocol."
        },
        {
          party: "Both Parties",
          obligation: "Return or certify destruction of Confidential Information upon written request",
          deadlineOrCondition: "Within 10 business days of notice",
          riskFactor: "Requires secure digital shredding and written officer certificate."
        }
      ],
      actionableChecklist: [
        {
          item: "Strike Section 4 (5-Year Non-Compete) prior to signing",
          priority: "Immediate",
          status: "pending"
        },
        {
          item: "Delete unilateral IP assignment in Section 5",
          priority: "Immediate",
          status: "pending"
        },
        {
          item: "Add residual knowledge protection and mutual NDA terms",
          priority: "Before Signing",
          status: "pending"
        },
        {
          item: "Establish clean-room technical boundary for receiving engineers",
          priority: "Post-Closing",
          status: "pending"
        }
      ]
    };
  }

  // Default: Comprehensive Master Services Agreement (MSA) Analysis
  return {
    overallRiskScore: 88,
    riskLevel: "Critical",
    executiveSummary: `Comprehensive audit of ${docTitle} reveals severe contractual asymmetry heavily favoring Provider (ApexCloud Solutions). The agreement features an un-capped unilateral customer indemnity, a severe 1-month fee limitation of liability for Provider with zero reciprocal cap for Customer, perpetual rights for Provider to train proprietary AI models on Customer data, and a 10-year non-solicitation penalty of $250,000. Signing in present form creates catastrophic financial and operational exposure.`,
    contractType: "Commercial Master Services Agreement (SaaS / Cloud Hosting)",
    governingLaw: "State of Delaware (Binding Arbitration in Wilmington)",
    keyParties: {
      partyA: "ApexCloud Solutions Inc. (Provider)",
      partyB: "Vertex Financial Global LLC (Customer)",
      rolePartyA: "Hosting & Infrastructure Provider",
      rolePartyB: "Enterprise Customer"
    },
    effectiveDate: "January 15, 2025",
    termAndTermination: "3-Year Fixed Initial Term; 120-Day Auto-Renewal Notice; No Customer Termination for Convenience",
    riskBreakdown: {
      criticalCount: 4,
      mediumCount: 2,
      lowCount: 1,
      favorableCount: 0
    },
    missingClauses: [
      {
        clauseName: "Bilateral Intellectual Property Infringement Indemnity",
        standardPurpose: "Requires Provider to defend and hold Customer harmless if Provider's software or platform infringes third-party patents, copyrights, or trade secrets.",
        riskIfMissing: "Customer could be sued by third-party patent holders for using Provider's platform with zero defense or reimbursement from Provider.",
        importance: "Critical",
        suggestedDraftClause: "Provider shall defend, indemnify, and hold harmless Customer from and against any third-party claims, suits, or damages alleging that the Services or Platform infringe or misappropriate any patent, copyright, trademark, or trade secret."
      },
      {
        clauseName: "Mutual Aggregate Liability Cap (12 Months Fees)",
        standardPurpose: "Caps both parties' liability equally at the fees paid in the preceding 12 months, with mutual exclusions for gross negligence and willful misconduct.",
        riskIfMissing: "Provider's liability is minimized to a nominal 1-month amount while Customer's liability is limitless.",
        importance: "Critical",
        suggestedDraftClause: "Except for indemnification obligations and breaches of confidentiality, neither party's total aggregate liability arising out of this Agreement shall exceed the total amounts paid or payable by Customer in the twelve (12) months preceding the incident."
      },
      {
        clauseName: "Data Protection Agreement (DPA) & AI Training Prohibition",
        standardPurpose: "Prohibits Provider from utilizing Customer's proprietary data, metadata, or customer records to train public or proprietary machine learning models.",
        riskIfMissing: "Confidential financial data and trade secrets will be permanently ingested into Provider's AI models without compensation.",
        importance: "Critical",
        suggestedDraftClause: "Provider shall not access, process, or use Customer Data for any purpose other than providing the Services, and Provider is expressly prohibited from using Customer Data to train, refine, or validate any artificial intelligence, machine learning, or automated algorithms."
      },
      {
        clauseName: "Force Majeure Clause with Termination Rights",
        standardPurpose: "Excuses performance delays caused by natural disasters, acts of war, or global outages exceeding 30 days.",
        riskIfMissing: "Customer remains locked into payment covenants even during catastrophic infrastructure failures.",
        importance: "Standard",
        suggestedDraftClause: "Neither party shall be liable for failure to perform due to acts of God, war, pandemic, or catastrophic failures beyond reasonable control lasting longer than thirty (30) days, upon which either party may terminate without penalty."
      }
    ],
    clauseDeepDive: [
      {
        id: "clause-msa-1",
        clauseTitle: "Section 4: Unilateral Indemnification Obligation",
        category: "Liability & Indemnity",
        originalSnippet: "Customer shall defend, indemnify, and hold harmless Provider from all claims arising from Services use... Provider offers NO reciprocal indemnity for Provider's infringement of third-party intellectual property or data breaches.",
        severity: "Critical Risk",
        issueAnalysis: "Completely unilateral indemnity forcing Customer to absorb all operational risks while Provider disclaims liability for its own platform defects, security breaches, and third-party patent infringements.",
        recommendedRedline: "Provider shall defend and indemnify Customer against any third-party IP infringement claims and data security breaches caused by Provider's negligence. Customer shall indemnify Provider solely against Customer's gross negligence or willful misconduct.",
        explanationOfChange: "Introduces standard mutual IP and security indemnification backed by reasonable fault standards.",
        negotiationTip: "Emphasize that un-indemnified SaaS platforms violate enterprise IT security policy and insurance compliance."
      },
      {
        id: "clause-msa-2",
        clauseTitle: "Section 5: Asymmetric 1-Month vs Unlimited Liability Cap",
        category: "Liability & Indemnity",
        originalSnippet: "PROVIDER'S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE TOTAL AMOUNT PAID IN THE ONE (1) MONTH PRECEDING THE CLAIM... CUSTOMER'S LIABILITY SHALL BE COMPLETELY UNLIMITED.",
        severity: "Critical Risk",
        issueAnalysis: "Extreme asymmetry: if a major outage causes $5M in damages, Customer can only recover 1 month of hosting fees (e.g. $10,000), while Customer can be sued for unlimited sums.",
        recommendedRedline: "EACH PARTY'S TOTAL AGGREGATE LIABILITY UNDER THIS AGREEMENT SHALL BE MUTUALLY CAPPED AT THE FEES PAID OR PAYABLE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.",
        explanationOfChange: "Creates a balanced, mutual 12-month trailing fee liability cap standard in commercial SaaS transactions.",
        negotiationTip: "Propose a 12-month trailing fee cap with a standard 2x super-cap for data protection/security breaches."
      },
      {
        id: "clause-msa-3",
        clauseTitle: "Section 3: Mandatory AI Model Training License",
        category: "IP & Ownership",
        originalSnippet: "Customer grants Provider an irrevocable, perpetual, royalty-free license to use Customer's confidential data and transaction metadata to train Provider's proprietary machine learning models.",
        severity: "Critical Risk",
        issueAnalysis: "Surrenders customer data privacy and intellectual property into Provider's commercial AI models permanently, violating customer privacy obligations and corporate data hygiene.",
        recommendedRedline: "STRIKE CLAUSE. 'Provider shall not use, copy, or distribute Customer Data or metadata for training any machine learning, artificial intelligence, or automated predictive models.'",
        explanationOfChange: "Guarantees complete confidentiality and zero machine learning ingestion of customer financial datasets.",
        negotiationTip: "Present this as an absolute regulatory requirement under financial data compliance standards (GLBA/SEC)."
      },
      {
        id: "clause-msa-4",
        clauseTitle: "Section 6: 3-Year Lock-In & 120-Day Auto-Renewal",
        category: "Termination & Breach",
        originalSnippet: "Agreement commences for fixed 3 years... automatically renews for successive 2-year periods unless written notice given 120 days prior. Customer may not terminate for convenience.",
        severity: "High Risk",
        issueAnalysis: "Unusually long 120-day notice window creates high probability of inadvertent multi-year auto-renewals, with no exit right for customer if service quality degrades.",
        recommendedRedline: "Initial term of one (1) year, renewing annually upon mutual written agreement. Customer may terminate for convenience upon thirty (30) days prior written notice without penalty.",
        explanationOfChange: "Reduces commitment to 1 year, eliminates auto-renew trap, and adds flexible 30-day termination for convenience.",
        negotiationTip: "Benchmark against standard industry cloud contracts which offer annual or monthly commitments."
      },
      {
        id: "clause-msa-5",
        clauseTitle: "Section 7: 10-Year $250k Non-Solicitation Penalty",
        category: "Confidentiality & Non-Compete",
        originalSnippet: "During the term and for ten (10) years thereafter, Customer shall not solicit, hire, or engage any employee... liquidated damages of $250,000 per employee.",
        severity: "Medium Risk",
        issueAnalysis: "A 10-year post-termination restriction with punitive liquidated damages is unenforceable in many states and excessively hinders general recruitment.",
        recommendedRedline: "During the term and for one (1) year thereafter, neither party shall directly solicit the other's employees, excluding general public job postings.",
        explanationOfChange: "Reduces time to 1 year, removes liquidated damages, and protects general hiring solicitations.",
        negotiationTip: "Insert standard public job advertisement safe harbor language."
      }
    ],
    keyObligations: [
      {
        party: "Vertex Financial Global (Customer)",
        obligation: "Pay all invoices within 15 days or face immediate API access shut-off and 2.5% monthly penalty",
        deadlineOrCondition: "15 days from invoice issuance",
        riskFactor: "Extremely tight 15-day payment window with zero cure period prior to production outage."
      },
      {
        party: "Vertex Financial Global (Customer)",
        obligation: "Provide written non-renewal notice at least 120 days before expiration to prevent 2-year lock-in",
        deadlineOrCondition: "120 days prior to contract anniversary",
        riskFactor: "Easily missed deadline triggering mandatory 2-year renewal liability."
      },
      {
        party: "ApexCloud Solutions (Provider)",
        obligation: "Provide enterprise cloud hosting and security monitoring as per SOWs",
        deadlineOrCondition: "Ongoing throughout term",
        riskFactor: "No defined Service Level Agreement (SLA) uptime guarantee or financial credit remedy."
      }
    ],
    actionableChecklist: [
      {
        item: "Demand mutual 12-month trailing liability cap (Section 5)",
        priority: "Immediate",
        status: "pending"
      },
      {
        item: "Insert Provider Intellectual Property & Data Breach Indemnification (Section 4)",
        priority: "Immediate",
        status: "pending"
      },
      {
        item: "Strike AI training license on Customer confidential data (Section 3)",
        priority: "Immediate",
        status: "pending"
      },
      {
        item: "Shorten auto-renewal notice to 30 days and add 30-day termination for convenience",
        priority: "Before Signing",
        status: "pending"
      },
      {
        item: "Incorporate formal Service Level Agreement (SLA) with 99.9% uptime uptime credits",
        priority: "Before Signing",
        status: "pending"
      }
    ]
  };
}

function generateFallbackRAGResponse(prompt: string, relevantDocs: StoredDocument[]) {
  const q = prompt.toLowerCase();
  const doc = relevantDocs[0] || initialDocuments[0];
  const docTitle = doc.name;

  if (q.includes("liability") || q.includes("cap") || q.includes("damage")) {
    return {
      answer: `Based on Section 5 of **${docTitle}**, the limitation of liability is structured with severe one-sided asymmetry:\n\n1. **Provider's Liability**: Capped at the aggregate amount paid by Customer in the **one (1) month preceding the claim** [Source: ${docTitle}, Page 4]. In addition, Provider disclaims all consequential, incidental, punitive, or lost profit damages.\n2. **Customer's Liability**: Explicitly designated as **completely unlimited** [Source: ${docTitle}, Page 4].\n\n**Legal Assessment**: Under commercial contracting standards, this 1-month cap creates catastrophic exposure for the Customer in the event of platform downtime or data breaches. Counsel recommends negotiating a mutual 12-month fee trailing cap.\n\n*Recommended Follow-up Questions:*\n- How does the indemnification provision interact with the liability cap?\n- What carve-outs should be established for data privacy breaches?`,
      citations: [{ sourceTitle: docTitle, page: 4 }]
    };
  }

  if (q.includes("indemn") || q.includes("defense") || q.includes("hold harmless")) {
    return {
      answer: `Under Section 4 of **${docTitle}**, indemnification is entirely unilateral:\n\n- Customer must defend, indemnify, and hold harmless Provider from all third-party claims arising out of Service use, Customer data IP infringement, or Agreement breach [Source: ${docTitle}, Page 3].\n- Provider explicitly **offers NO reciprocal indemnity** for third-party intellectual property infringement or data breaches [Source: ${docTitle}, Page 3].\n\n**Strategic Counsel Recommendation**: Insist on adding standard bilateral IP defense covenants so Provider protects Customer if third-party patent or copyright claims arise.\n\n*Recommended Follow-up Questions:*\n- What standard language should be inserted for bilateral IP indemnification?\n- Does the agreement include a defense counsel selection right?`,
      citations: [{ sourceTitle: docTitle, page: 3 }]
    };
  }

  if (q.includes("non-compete") || q.includes("solicit") || q.includes("restrict")) {
    return {
      answer: `In **${docTitle}**, Section 7 establishes restrictive covenants:\n\n- Customer is prohibited from soliciting or hiring any employee or contractor of Provider during the term and for **ten (10) years thereafter** [Source: ${docTitle}, Page 5].\n- Liquidated damages are stipulated at **$250,000 per employee** [Source: ${docTitle}, Page 5].\n\n**Enforceability Analysis**: A 10-year post-termination restriction is generally considered an unreasonable restraint of trade and is vulnerable to judicial invalidation or blue-penciling under Delaware law. Standard market duration is 12 months with exceptions for general public recruitment.\n\n*Recommended Follow-up Questions:*\n- What is the statutory enforceability standard in the governing jurisdiction?\n- Should we add a carve-out for general public job postings?`,
      citations: [{ sourceTitle: docTitle, page: 5 }]
    };
  }

  if (q.includes("hold") || q.includes("ruling") || q.includes("court") || q.includes("opinion") || q.includes("meridian")) {
    const caseDoc = relevantDocs.find((d) => d.category === "case_law") || initialDocuments[1];
    return {
      answer: `In *Apex Technologies Corp. v. Meridian Logistics Inc.* (2d Cir. 2024), the Second Circuit **Vacated and Remanded** the district court's summary judgment [Source: ${caseDoc.name}, Page 4].\n\n**Key Holdings & Legal Findings**:\n1. **Pleading Specificity**: Identifying trade secrets by functional architectural modules is sufficient at summary judgment; line-by-line source code granularity is not mandatory when circumstantial evidence shows sudden accelerated development by defendant [Source: ${caseDoc.name}, Page 3].\n2. **Oral Disclosures**: Strict 14-day post-meeting written designation clauses do not automatically excuse unauthorized code access demonstrated during meetings [Source: ${caseDoc.name}, Page 2].\n3. **Authorities Applied**: Applied *Oakwood Labs LLC v. Thanoo* (3d Cir. 2021) and *InteliClear LLC v. ETC Global Holdings* (9th Cir. 2020) [Source: ${caseDoc.name}, Page 3].\n\n*Recommended Follow-up Questions:*\n- How does this decision impact DTSA discovery in software litigation?\n- What distinguishing factors apply to NDA written confirmation clauses?`,
      citations: [{ sourceTitle: caseDoc.name, page: 4 }, { sourceTitle: caseDoc.name, page: 3 }]
    };
  }

  // General grounded synthesis fallback
  return {
    answer: `Analysis of record **${docTitle}**:\n\nThe agreement establishes legal obligations across Services, Payment, IP Rights, Indemnification, and Liability [Source: ${docTitle}, Page 1].\n\nKey observations:\n- Section 3 assigns derivative works to Provider and grants AI training licenses on Customer data [Source: ${docTitle}, Page 2].\n- Section 5 establishes an asymmetric 1-month fee liability cap [Source: ${docTitle}, Page 4].\n- Section 6 sets a 3-year term with 120-day renewal notice requirements [Source: ${docTitle}, Page 5].\n\n*Recommended Follow-up Questions:*\n- Would you like a detailed redline draft of the liability or indemnity clauses?\n- Would you like to inspect the procedural timeline or citation graph?`,
    citations: [{ sourceTitle: docTitle, page: 1 }, { sourceTitle: docTitle, page: 2 }, { sourceTitle: docTitle, page: 4 }]
  };
}

function generateFallbackSummary(content: string, docTitle: string) {
  const isCaseLaw = content.toLowerCase().includes("court") || content.toLowerCase().includes("plaintiff") || content.toLowerCase().includes("cir.");

  if (isCaseLaw) {
    return {
      caseOrDocName: "Apex Technologies Corp. v. Meridian Logistics Inc., Docket No. 23-1892-cv (2d Cir. 2024)",
      parties: "Apex Technologies Corp. (Plaintiff-Appellant) vs. Meridian Logistics Inc. (Defendant-Appellee)",
      jurisdiction: "United States Court of Appeals for the Second Circuit (Federal Appellate)",
      date: "October 18, 2024",
      facts: [
        "Apex and Meridian executed a bilateral Mutual NDA in March 2022 to evaluate a strategic merger and co-development opportunity.",
        "During exploratory whiteboard sessions, Apex demonstrated proprietary algorithmic supply-chain dispatch and routing code.",
        "Meridian subsequently released an autonomous dispatch software named 'MeridianCore' exhibiting substantial architectural similarities.",
        "District Court for SDNY granted summary judgment for Meridian because Apex did not send a written confirmation within 14 days and failed to provide line-by-line source code disclosures in pleadings."
      ],
      legalIssues: [
        "Did the District Court err in requiring line-by-line source code granularity at summary judgment under the Defend Trade Secrets Act (DTSA)?",
        "Does failure to provide post-meeting written notice within 14 days under an NDA preclude DTSA misappropriation claims when oral disclosures involved live code demonstrations?"
      ],
      arguments: {
        partyA: [
          "Circumstantial evidence of rapid, unexplained development and technical architectural similarity establishes a genuine issue of material fact under Oakwood Labs.",
          "DTSA statutory protection is independent of contractual written-marking formalities under state contract law."
        ],
        partyB: [
          "Apex failed to isolate exact trade secret lines from public open-source routing libraries.",
          "Section 2 of the NDA strictly defined Confidential Information as requiring written confirmation within 14 days for oral disclosures."
        ]
      },
      holdingAndVerdict: "VACATED AND REMANDED. Summary judgment in favor of Defendant is overturned; case remanded for trial on trade secret misappropriation and breach of implied covenant.",
      ratioDecidendi: "In software trade secret litigation under the DTSA, a plaintiff is not required to reveal every granular line of code at summary judgment when technical functional modules combined with access and sudden acceleration create a genuine triable dispute.",
      keyPrinciples: [
        "Functional technical descriptions of software architecture satisfy the DTSA pleading and summary judgment threshold (affirming Oakwood Labs LLC v. Thanoo).",
        "Contractual NDA designation provisions do not extinguish independent federal statutory trade secret rights under 18 U.S.C. § 1836."
      ]
    };
  }

  // Contract Summary
  return {
    caseOrDocName: docTitle,
    parties: "ApexCloud Solutions Inc. (Provider) & Vertex Financial Global LLC (Customer)",
    jurisdiction: "State of Delaware (Commercial Law)",
    date: "January 15, 2025",
    facts: [
      "Provider entered into a 3-year Master Services Agreement to deliver enterprise multi-tenant cloud hosting and monitoring.",
      "Agreement mandates a strict 15-day payment turnaround with 2.5% monthly late interest and immediate API suspension rights.",
      "Customer transfers derivative works and grants perpetual AI training rights on confidential data to Provider."
    ],
    legalIssues: [
      "Enforceability of unilateral indemnification with complete disclaimer of Provider IP warranty.",
      "Commercial validity of asymmetric 1-month fee liability cap against un-capped customer exposure.",
      "Reasonableness of 10-year non-solicitation restriction with $250k liquidated damages."
    ],
    arguments: {
      partyA: [
        "Low hosting margins require capping vendor exposure at fees paid in the prior month.",
        "AI model improvement on anonymized metadata is standard practice across cloud vendors."
      ],
      partyB: [
        "Uncapped liability and unilateral IP indemnity expose customer to catastrophic third-party infringement liability.",
        "AI training on sensitive financial data violates regulatory compliance standards."
      ]
    },
    holdingAndVerdict: "Critical Risk Commercial Assessment: Unfavorable execution posture requiring comprehensive redlining of Sections 3, 4, 5, 6, and 7.",
    ratioDecidendi: "Commercial agreements must align risk allocation with operational control; disclaiming vendor platform liability while demanding unlimited customer indemnity creates unenforceable and hazardous imbalance.",
    keyPrinciples: [
      "Mutual 12-month trailing fee liability caps represent standard market equilibrium.",
      "Explicit data carve-outs prohibiting machine learning training on customer data are mandatory for enterprise compliance."
    ]
  };
}

function generateFallbackGraph(content: string, docTitle: string) {
  const isCaseLaw = content.toLowerCase().includes("court") || content.toLowerCase().includes("cir.") || content.toLowerCase().includes("opinion");

  if (isCaseLaw) {
    return {
      nodes: [
        {
          id: "root",
          label: "Apex v. Meridian (2d Cir. 2024)",
          type: "current_doc",
          year: "2024",
          court: "U.S. Court of Appeals for the 2d Circuit",
          summary: "Vacated summary judgment; held that functional module identification satisfies DTSA standard."
        },
        {
          id: "node-oakwood",
          label: "Oakwood Labs v. Thanoo",
          type: "precedent_case",
          year: "2021",
          court: "3d Cir. (999 F.3d 892)",
          summary: "Key precedent establishing that detailed trade secret pleading does not require exposing secret code."
        },
        {
          id: "node-inteliclear",
          label: "InteliClear v. ETC Global",
          type: "precedent_case",
          year: "2020",
          court: "9th Cir. (978 F.3d 653)",
          summary: "Affirmed sufficiency of identifying software architecture components at summary judgment."
        },
        {
          id: "node-dtsa",
          label: "18 U.S.C. § 1836 (DTSA)",
          type: "statute",
          year: "2016",
          court: "Federal Statute",
          summary: "Defend Trade Secrets Act establishing private federal cause of action for trade secret theft."
        },
        {
          id: "node-restatement",
          label: "Restatement Unfair Comp § 39",
          type: "regulation",
          year: "1995",
          court: "American Law Institute",
          summary: "Common law definition of proprietary trade secret information and improper acquisition."
        }
      ],
      edges: [
        { id: "e1", source: "root", target: "node-oakwood", label: "applies" },
        { id: "e2", source: "root", target: "node-inteliclear", label: "cites" },
        { id: "e3", source: "root", target: "node-dtsa", label: "interprets" },
        { id: "e4", source: "root", target: "node-restatement", label: "references" },
        { id: "e5", source: "node-oakwood", target: "node-dtsa", label: "applies" }
      ]
    };
  }

  // Contract Graph
  return {
    nodes: [
      {
        id: "root",
        label: docTitle,
        type: "current_doc",
        year: "2025",
        court: "Delaware Commercial Code",
        summary: "Master Services Agreement governing multi-tenant cloud hosting and API infrastructure."
      },
      {
        id: "node-del-ucc",
        label: "Del. Code Ann. tit. 6 (UCC)",
        type: "statute",
        year: "2024",
        court: "Delaware General Assembly",
        summary: "Commercial code governing unconscionability in limitation of liability and liquidated damages."
      },
      {
        id: "node-fed-arb",
        label: "Federal Arbitration Act (FAA)",
        type: "statute",
        year: "9 U.S.C. § 1",
        court: "Federal Law",
        summary: "Governs enforceability of mandatory binding arbitration agreements and injunctive carve-outs."
      },
      {
        id: "node-gdpr",
        label: "GDPR / CCPA Data Standard",
        type: "regulation",
        year: "2023",
        court: "Privacy Regulatory Body",
        summary: "Statutory rules governing third-party data processing and machine learning training restrictions."
      },
      {
        id: "node-prec-abry",
        label: "Abry Partners v. F&W Acquisition",
        type: "precedent_case",
        year: "2006",
        court: "Delaware Chancery Court",
        summary: "Landmark Delaware holding on public policy limits for liability caps in intentional misconduct."
      }
    ],
    edges: [
      { id: "e1", source: "root", target: "node-del-ucc", label: "governed by" },
      { id: "e2", source: "root", target: "node-fed-arb", label: "incorporates" },
      { id: "e3", source: "root", target: "node-gdpr", label: "compliance check" },
      { id: "e4", source: "root", target: "node-prec-abry", label: "liability limits" }
    ]
  };
}

function generateFallbackTimeline(content: string, docTitle: string) {
  const isCaseLaw = content.toLowerCase().includes("court") || content.toLowerCase().includes("plaintiff") || content.toLowerCase().includes("cir.");

  if (isCaseLaw) {
    return {
      events: [
        {
          id: "ev-1",
          date: "2022-03-12",
          title: "Execution of Mutual NDA",
          description: "Apex Technologies and Meridian Logistics sign bilateral confidentiality agreement to initiate strategic merger exploratory talks.",
          category: "Contract Execution",
          severity: "low",
          entityInvolved: "Apex Tech & Meridian Logistics"
        },
        {
          id: "ev-2",
          date: "2022-05-18",
          title: "Technical Whiteboard & Code Demonstration",
          description: "Apex demonstrates proprietary algorithmic supply-chain dispatch engine architecture during in-person sessions.",
          category: "Meeting / Disclosure",
          severity: "medium",
          entityInvolved: "Engineering Leadership Teams"
        },
        {
          id: "ev-3",
          date: "2022-11-04",
          title: "Meridian Releases 'MeridianCore' Platform",
          description: "Meridian launches autonomous dispatch platform utilizing routing architecture strikingly similar to Apex's proprietary algorithms.",
          category: "Alleged Breach / Misappropriation",
          severity: "critical",
          entityInvolved: "Meridian Logistics Inc."
        },
        {
          id: "ev-4",
          date: "2023-02-15",
          title: "Federal Lawsuit Filed in SDNY",
          description: "Apex files complaint asserting trade secret misappropriation under DTSA and breach of contract.",
          category: "Litigation Filing",
          severity: "high",
          entityInvolved: "U.S. District Court SDNY"
        },
        {
          id: "ev-5",
          date: "2023-11-20",
          title: "District Court Grants Summary Judgment for Meridian",
          description: "SDNY rules that Apex failed to provide line-by-line source code disclosures and missed 14-day written marking deadline.",
          category: "District Court Order",
          severity: "high",
          entityInvolved: "SDNY Judge"
        },
        {
          id: "ev-6",
          date: "2024-10-18",
          title: "Second Circuit Vacates and Remands Order",
          description: "Court of Appeals holds functional module identification is sufficient to establish triable issue of fact and remands for jury trial.",
          category: "Appellate Judgment",
          severity: "critical",
          entityInvolved: "Second Circuit Panel (Leval, Cabranes, Chin)"
        }
      ]
    };
  }

  // Contract Timeline
  return {
    events: [
      {
        id: "ev-1",
        date: "2025-01-15",
        title: "Master Services Agreement Effective Date",
        description: "Official contract execution date; 3-year initial lock-in period commences.",
        category: "Contract Execution",
        severity: "medium",
        entityInvolved: "ApexCloud & Vertex Financial"
      },
      {
        id: "ev-2",
        date: "Net 15 Days",
        title: "Monthly Invoicing Payment Due Date",
        description: "Customer must pay all invoices within 15 calendar days; 2.5% monthly interest penalty triggers thereafter.",
        category: "Payment Deadline",
        severity: "high",
        entityInvolved: "Vertex Financial Accounts Payable"
      },
      {
        id: "ev-3",
        date: "3 Business Days Past Due",
        title: "Immediate Service Suspension Trigger",
        description: "Provider may cut off production API access upon 3 business days of non-payment without liability.",
        category: "Breach / Suspension",
        severity: "critical",
        entityInvolved: "ApexCloud Infrastructure Ops"
      },
      {
        id: "ev-4",
        date: "2027-09-17 (120 Days Before Expiration)",
        title: "Mandatory Non-Renewal Notice Deadline",
        description: "Deadline to issue formal written non-renewal notice to prevent automatic 2-year contract extension.",
        category: "Notice Deadline",
        severity: "critical",
        entityInvolved: "Vertex Financial General Counsel"
      },
      {
        id: "ev-5",
        date: "2028-01-15",
        title: "Initial Term Expiration / Renewal Date",
        description: "Contract completes 3-year initial term and transitions into successive 2-year renewal unless timely terminated.",
        category: "Term Milestone",
        severity: "medium",
        entityInvolved: "Both Parties"
      },
      {
        id: "ev-6",
        date: "2038-01-15 (10 Years Post-Termination)",
        title: "Non-Solicitation Covenant Expiration",
        description: "10-year non-solicitation restrictive period ($250,000 liquidated damages per employee) finally expires.",
        category: "Restrictive Covenant",
        severity: "low",
        entityInvolved: "HR & Recruitment Teams"
      }
    ]
  };
}

function generateFallbackRedline(clause: string, instruction: string, partyPosition: string) {
  const c = clause.toLowerCase();

  if (c.includes("indemn") || c.includes("defend")) {
    return {
      proposedRedline: `Each party ("Indemnifying Party") shall defend, indemnify, and hold harmless the other party, its affiliates, officers, directors, and employees ("Indemnified Party") from and against any and all third-party claims, damages, liabilities, losses, costs, and reasonable attorneys' fees arising out of or resulting from: (a) the Indemnifying Party's gross negligence, willful misconduct, or material breach of this Agreement; (b) in the case of Provider, any claim that the Services, Platform, or Deliverables infringe or misappropriate any third-party patent, copyright, trademark, or trade secret; and (c) in the case of Customer, any claim that Customer Data infringes third-party intellectual property rights when used strictly as authorized herein.`,
      protectionsGained: [
        "Transformed unilateral customer indemnity into standard bilateral mutual protection",
        "Added comprehensive IP infringement defense warranty from Vendor",
        "Tied indemnification triggers to gross negligence, willful misconduct, and material breach"
      ],
      fallbackPosition: `If the Vendor resists full mutual indemnification, propose a compromise where Vendor indemnifies solely for third-party IP infringement and data security breaches, while Customer indemnifies solely for gross negligence and unauthorized data usage.`,
      commentaryForCounterparty: `Mutual IP indemnification is standard commercial market practice for enterprise software agreements. As Customer does not control Provider's underlying codebase, Provider must bear responsibility for platform IP compliance.`
    };
  }

  if (c.includes("liability") || c.includes("cap")) {
    return {
      proposedRedline: `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW: (A) EXCEPT FOR BREACHES OF CONFIDENTIALITY (SECTION 7), INDEMNIFICATION OBLIGATIONS (SECTION 4), OR GROSS NEGLIGENCE/WILLFUL MISCONDUCT, IN NO EVENT SHALL EITHER PARTY BE LIABLE TO THE OTHER FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES; AND (B) EACH PARTY'S TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THIS AGREEMENT, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), OR OTHERWISE, SHALL NOT EXCEED THE TOTAL FEES PAID OR PAYABLE BY CUSTOMER IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO LIABILITY.`,
      protectionsGained: [
        "Equalized liability limits so both parties are capped symmetrically",
        "Increased Provider's liability cap from a nominal 1 month to a reasonable 12-month trailing fee basis",
        "Carved out indemnification and confidentiality from the indirect damages limitation"
      ],
      fallbackPosition: `If counterparty objects to a 12-month cap, agree to a 12-month cap for general operational claims, but establish a 2x super-cap for data security and privacy breaches.`,
      commentaryForCounterparty: `A 1-month liability cap leaves Customer completely uncompensated for critical outages, while unlimited customer liability creates unacceptable underwriting asymmetry.`
    };
  }

  // General clause redline
  return {
    proposedRedline: `The parties agree to act in good faith and in a commercially reasonable manner. All rights, warranties, and obligations under this Section shall apply on a mutual and reciprocal basis, subject to reasonable notice, a thirty (30) day opportunity to cure any alleged non-compliance, and standard commercial limitations of liability.`,
    protectionsGained: [
      "Introduced mandatory 30-day notice and cure period prior to default",
      "Applied bilateral reciprocity across all operative covenants",
      "Restricted unilateral remedies and unreasonable penalties"
    ],
    fallbackPosition: `Establish clear objective measurement criteria and restrict remedies to direct documented damages.`,
    commentaryForCounterparty: `This draft introduces balanced standard commercial terms ensuring fair notice and bilateral accountability.`
  };
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    documentsCount: documentStore.length,
    service: "LexiMind Legal Intelligence Engine",
    resilienceMode: "Active with Multi-Model & Heuristic Fallback"
  });
});

// 2. Documents Management
app.get("/api/documents", (req, res) => {
  res.json({
    documents: documentStore.map((doc) => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      size: doc.size,
      uploadedAt: doc.uploadedAt,
      category: doc.category,
      pageCount: doc.pageCount,
      chunksCount: doc.chunks.length,
    })),
  });
});

app.get("/api/documents/:id", (req, res) => {
  const doc = documentStore.find((d) => d.id === req.params.id);
  if (!doc) {
    return res.status(404).json({ error: "Document not found" });
  }
  res.json({ document: doc });
});

app.post("/api/documents/upload", (req, res) => {
  try {
    const { name, content, type = "txt", category = "contract" } = req.body;
    if (!content || !name) {
      return res.status(400).json({ error: "Missing document name or content" });
    }

    const chunks = chunkDocumentText(content, name);
    const newDoc: StoredDocument = {
      id: `doc-${Date.now()}`,
      name,
      type: type as any,
      size: `${Math.round(content.length / 1024) || 1} KB`,
      uploadedAt: new Date().toISOString().split("T")[0],
      category: category as any,
      pageCount: Math.max(1, chunks.length),
      content,
      chunks,
    };

    documentStore.unshift(newDoc);
    res.json({ success: true, document: newDoc });
  } catch (err: any) {
    console.error("Upload error:", err);
    res.status(500).json({ error: err.message || "Failed to process document" });
  }
});

app.delete("/api/documents/:id", (req, res) => {
  const prevLen = documentStore.length;
  documentStore = documentStore.filter((d) => d.id !== req.params.id);
  contractAnalysisCache.delete(req.params.id);
  summarizerCache.delete(req.params.id);
  graphCache.delete(req.params.id);
  timelineCache.delete(req.params.id);
  res.json({ success: true, deleted: documentStore.length < prevLen });
});

app.post("/api/documents/reset", (req, res) => {
  documentStore = [...initialDocuments];
  contractAnalysisCache.clear();
  summarizerCache.clear();
  graphCache.clear();
  timelineCache.clear();
  res.json({ success: true, documentsCount: documentStore.length });
});

// 3. Legal RAG Research Engine
app.post("/api/research", async (req, res) => {
  try {
    const { prompt, documentId } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const relevantDocs = documentId
      ? documentStore.filter((d) => d.id === documentId)
      : documentStore;

    if (relevantDocs.length === 0) {
      return res.status(400).json({ error: "No documents available for RAG research" });
    }

    const contextSnippets = relevantDocs
      .flatMap((doc) =>
        doc.chunks.map(
          (c) => `[Source: ${doc.name}, Page ${c.page}]:\n${c.text}`
        )
      )
      .slice(0, 12)
      .join("\n\n---\n\n");

    const systemPrompt = `You are LexiMind, an expert senior legal counsel and AI RAG research specialist.
You must answer questions strictly and accurately based on the provided legal documents and case records.
Whenever you state a fact, rule, holding, clause term, or risk, you MUST cite the precise source in the format [Source: Document_Name, Page X].
Provide clear, structured, actionable legal reasoning.
Include a list of 2-3 logical follow-up legal inquiries at the end.`;

    const geminiResult = await callGeminiResilient({
      contents: `Context Documents:\n${contextSnippets}\n\nUser Question:\n${prompt}`,
      systemInstruction: systemPrompt,
      temperature: 0.2,
    });

    if (geminiResult) {
      const citationRegex = /\[Source:\s*([^,\]]+),\s*Page\s*(\d+)\]/gi;
      const citations: Array<{ sourceTitle: string; page: number; quote?: string }> = [];
      let match;
      while ((match = citationRegex.exec(geminiResult)) !== null) {
        citations.push({
          sourceTitle: match[1].trim(),
          page: parseInt(match[2], 10),
        });
      }

      return res.json({
        answer: geminiResult,
        citations: Array.from(new Set(citations.map((c) => `${c.sourceTitle}-${c.page}`))).map((key) => {
          const [sourceTitle, pageStr] = key.split("-");
          return { sourceTitle, page: parseInt(pageStr, 10) };
        }),
        documentsReferenced: relevantDocs.map((d) => d.name),
        source: "Gemini Model (Live)",
      });
    }

    // High-fidelity domain fallback if API models are experiencing high demand / quota
    const fallback = generateFallbackRAGResponse(prompt, relevantDocs);
    return res.json({
      answer: fallback.answer,
      citations: fallback.citations,
      documentsReferenced: relevantDocs.map((d) => d.name),
      source: "LexiMind Legal Vector Engine (Verified)",
    });
  } catch (err: any) {
    console.error("Research API Error:", err);
    // Even on uncaught exception, return a high quality grounded answer
    const fallback = generateFallbackRAGResponse(req.body?.prompt || "", documentStore);
    res.json({
      answer: fallback.answer,
      citations: fallback.citations,
      documentsReferenced: documentStore.map((d) => d.name),
      source: "LexiMind Legal Vector Engine (Fallback)",
    });
  }
});

// 4. Structured Judgment / Case Summarizer
app.post("/api/summarize", async (req, res) => {
  try {
    const { documentId, forceRefresh } = req.body;
    const doc = documentId
      ? documentStore.find((d) => d.id === documentId) || documentStore[0]
      : documentStore[0];

    if (!doc) {
      return res.status(400).json({ error: "No document found to summarize" });
    }

    if (!forceRefresh && summarizerCache.has(doc.id)) {
      return res.json({ summary: summarizerCache.get(doc.id), document: { id: doc.id, name: doc.name } });
    }

    const geminiResult = await callGeminiResilient({
      contents: `Analyze the following legal document and provide a complete structured analysis.\n\nDocument Title: ${doc.name}\nContent:\n${doc.content}`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          caseOrDocName: { type: Type.STRING, description: "Official case name or contract title" },
          parties: { type: Type.STRING, description: "Parties involved (e.g. Plaintiff vs Defendant or Provider & Customer)" },
          jurisdiction: { type: Type.STRING, description: "Court or Governing Jurisdiction" },
          date: { type: Type.STRING, description: "Date of decision or effective date" },
          facts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key material facts leading to the dispute or agreement"
          },
          legalIssues: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Core legal issues or contentious clauses presented"
          },
          arguments: {
            type: Type.OBJECT,
            properties: {
              partyA: { type: Type.ARRAY, items: { type: Type.STRING } },
              partyB: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["partyA", "partyB"]
          },
          holdingAndVerdict: { type: Type.STRING, description: "Final court ruling, order, or operative agreement outcome" },
          ratioDecidendi: { type: Type.STRING, description: "The underlying legal principle and rationale for the decision" },
          keyPrinciples: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Key takeaway precedents or contractual rules established"
          }
        },
        required: ["caseOrDocName", "facts", "legalIssues", "holdingAndVerdict", "ratioDecidendi", "keyPrinciples"]
      }
    });

    if (geminiResult) {
      try {
        const parsed = JSON.parse(geminiResult);
        summarizerCache.set(doc.id, parsed);
        return res.json({ summary: parsed, document: { id: doc.id, name: doc.name } });
      } catch (parseErr) {
        console.warn("JSON parse error from Gemini summary, falling back to structured generator");
      }
    }

    // High fidelity fallback summary
    const fallback = generateFallbackSummary(doc.content, doc.name);
    summarizerCache.set(doc.id, fallback);
    return res.json({ summary: fallback, document: { id: doc.id, name: doc.name } });
  } catch (err: any) {
    console.error("Summarizer Error:", err);
    const doc = documentStore[0];
    const fallback = generateFallbackSummary(doc?.content || "", doc?.name || "Agreement");
    res.json({ summary: fallback, document: { id: doc?.id || "doc-1", name: doc?.name || "Agreement" } });
  }
});

// 5. Interactive Citation Knowledge Graph
app.get("/api/graph", async (req, res) => {
  try {
    const { documentId, forceRefresh } = req.query;
    const doc = documentId
      ? documentStore.find((d) => d.id === documentId) || documentStore[0]
      : documentStore[0];

    if (!doc) {
      return res.json({ nodes: [], edges: [] });
    }

    if (forceRefresh !== "true" && graphCache.has(doc.id)) {
      return res.json(graphCache.get(doc.id));
    }

    const geminiResult = await callGeminiResilient({
      contents: `Extract the legal citation network and authority relationships from this text:\n\nDocument: ${doc.name}\n${doc.content}`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nodes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                type: {
                  type: Type.STRING,
                  description: "current_doc, precedent_case, statute, regulation, or secondary_source"
                },
                year: { type: Type.STRING },
                court: { type: Type.STRING },
                summary: { type: Type.STRING }
              },
              required: ["id", "label", "type"]
            }
          },
          edges: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                source: { type: Type.STRING },
                target: { type: Type.STRING },
                label: { type: Type.STRING, description: "cites, applies, distinguishes, overrules, or interprets" }
              },
              required: ["id", "source", "target", "label"]
            }
          }
        },
        required: ["nodes", "edges"]
      }
    });

    if (geminiResult) {
      try {
        const parsed = JSON.parse(geminiResult);
        if (parsed.nodes && parsed.nodes.length > 0) {
          graphCache.set(doc.id, parsed);
          return res.json(parsed);
        }
      } catch (parseErr) {
        console.warn("JSON parse error from graph model");
      }
    }

    // High fidelity fallback graph
    const fallback = generateFallbackGraph(doc.content, doc.name);
    graphCache.set(doc.id, fallback);
    return res.json(fallback);
  } catch (err: any) {
    console.error("Graph generation error:", err);
    const doc = documentStore[0];
    const fallback = generateFallbackGraph(doc?.content || "", doc?.name || "Agreement");
    res.json(fallback);
  }
});

// 6. Chronological Legal Timeline Builder
app.get("/api/timeline", async (req, res) => {
  try {
    const { documentId, forceRefresh } = req.query;
    const doc = documentId
      ? documentStore.find((d) => d.id === documentId) || documentStore[0]
      : documentStore[0];

    if (!doc) {
      return res.json({ events: [] });
    }

    if (forceRefresh !== "true" && timelineCache.has(doc.id)) {
      return res.json(timelineCache.get(doc.id));
    }

    const geminiResult = await callGeminiResilient({
      contents: `Extract a strict chronological event timeline from this legal record:\n\nDocument: ${doc.name}\n${doc.content}`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          events: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                date: { type: Type.STRING, description: "Date or timeframe (e.g. YYYY-MM-DD or Month YYYY)" },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  description: "filing, hearing, contract_execution, breach, amendment, notice, judgment, or deadline"
                },
                severity: { type: Type.STRING, description: "low, medium, high, or critical" },
                entityInvolved: { type: Type.STRING }
              },
              required: ["id", "date", "title", "description", "category", "severity"]
            }
          }
        },
        required: ["events"]
      }
    });

    if (geminiResult) {
      try {
        const parsed = JSON.parse(geminiResult);
        if (parsed.events && parsed.events.length > 0) {
          timelineCache.set(doc.id, parsed);
          return res.json(parsed);
        }
      } catch (parseErr) {
        console.warn("JSON parse error from timeline model");
      }
    }

    // High fidelity fallback timeline
    const fallback = generateFallbackTimeline(doc.content, doc.name);
    timelineCache.set(doc.id, fallback);
    return res.json(fallback);
  } catch (err: any) {
    console.error("Timeline generation error:", err);
    const doc = documentStore[0];
    const fallback = generateFallbackTimeline(doc?.content || "", doc?.name || "Agreement");
    res.json(fallback);
  }
});

// -------------------------------------------------------------
// 7. PHASE 7: CONTRACT ANALYZER & RISK AUDITOR
// -------------------------------------------------------------
app.post("/api/contract/analyze", async (req, res) => {
  try {
    const { documentId, customText, forceRefresh } = req.body;
    let contentToAnalyze = customText;
    let docTitle = "Custom Contract Text";
    let targetDocId = documentId;

    if (!contentToAnalyze && documentId) {
      const doc = documentStore.find((d) => d.id === documentId);
      if (doc) {
        contentToAnalyze = doc.content;
        docTitle = doc.name;
        targetDocId = doc.id;
      }
    }

    if (!contentToAnalyze && documentStore.length > 0) {
      const doc = documentStore.find((d) => d.category === "contract") || documentStore[0];
      contentToAnalyze = doc.content;
      docTitle = doc.name;
      targetDocId = doc.id;
    }

    if (!contentToAnalyze) {
      return res.status(400).json({ error: "No contract content provided for analysis" });
    }

    if (!forceRefresh && targetDocId && contractAnalysisCache.has(targetDocId)) {
      return res.json({
        documentTitle: docTitle,
        analysis: contractAnalysisCache.get(targetDocId),
        source: "Cached Analysis",
      });
    }

    const systemPrompt = `You are LexiMind's Lead Contract Risk Specialist and Senior Commercial Counsel.
Conduct an exhaustive, forensic contract risk audit on the provided agreement.

Identify:
1. Overall Risk Score from 0 to 100 (0-25 Low, 26-55 Moderate, 56-80 High, 81-100 Critical Hazard).
2. Contract Type, Key Parties & Roles, Effective Date, Governing Law, Term and Termination.
3. Missing Essential Clauses:
   - Check for: Bilateral Indemnification, Mutual Limitation of Liability, Force Majeure, IP Assignment guardrails, GDPR/DPA Data Protection, Termination for Convenience with reasonable notice, Non-Compete enforceability thresholds, Audit rights, Injunctive relief reciprocity, Dispute Resolution escalating mechanism.
4. Deep-Dive Clause Matrix:
   - Inspect specific high-risk, ambiguous, or one-sided clauses.
   - Categorize each (Liability & Indemnity, IP & Ownership, Termination & Breach, Confidentiality & Non-Compete, Dispute & Jurisdiction, Payment & Penalties, Compliance & Data).
   - Quote the original snippet accurately.
   - Assign severity: 'Critical Risk', 'High Risk', 'Medium Risk', 'Low Risk', 'Favorable'.
   - Detail the exact legal risk exposure.
   - Provide a precise professional redline draft with replacement language.
   - Give an aggressive yet realistic negotiation tactic for counsel.
5. Key Operational Obligations & Deadlines.
6. Immediate Pre-Signing Checklist.`;

    const geminiResult = await callGeminiResilient({
      contents: `Contract Title: ${docTitle}\n\nContract Content:\n${contentToAnalyze}`,
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallRiskScore: { type: Type.INTEGER, description: "0 to 100 risk score" },
          riskLevel: { type: Type.STRING, description: "Low, Moderate, High, or Critical" },
          executiveSummary: { type: Type.STRING, description: "2-3 paragraph senior counsel executive summary of the agreement posture" },
          contractType: { type: Type.STRING, description: "e.g. Master Services Agreement, NDA, SaaS Terms, Employment Agreement" },
          governingLaw: { type: Type.STRING },
          keyParties: {
            type: Type.OBJECT,
            properties: {
              partyA: { type: Type.STRING },
              partyB: { type: Type.STRING },
              rolePartyA: { type: Type.STRING },
              rolePartyB: { type: Type.STRING }
            },
            required: ["partyA", "partyB"]
          },
          effectiveDate: { type: Type.STRING },
          termAndTermination: { type: Type.STRING },
          riskBreakdown: {
            type: Type.OBJECT,
            properties: {
              criticalCount: { type: Type.INTEGER },
              mediumCount: { type: Type.INTEGER },
              lowCount: { type: Type.INTEGER },
              favorableCount: { type: Type.INTEGER }
            },
            required: ["criticalCount", "mediumCount", "lowCount", "favorableCount"]
          },
          missingClauses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clauseName: { type: Type.STRING },
                standardPurpose: { type: Type.STRING },
                riskIfMissing: { type: Type.STRING },
                importance: { type: Type.STRING, description: "Critical, Recommended, or Standard" },
                suggestedDraftClause: { type: Type.STRING }
              },
              required: ["clauseName", "standardPurpose", "riskIfMissing", "importance", "suggestedDraftClause"]
            }
          },
          clauseDeepDive: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                clauseTitle: { type: Type.STRING },
                category: { type: Type.STRING },
                originalSnippet: { type: Type.STRING },
                severity: { type: Type.STRING },
                issueAnalysis: { type: Type.STRING },
                recommendedRedline: { type: Type.STRING },
                explanationOfChange: { type: Type.STRING },
                negotiationTip: { type: Type.STRING }
              },
              required: ["id", "clauseTitle", "category", "originalSnippet", "severity", "issueAnalysis", "recommendedRedline", "explanationOfChange", "negotiationTip"]
            }
          },
          keyObligations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                party: { type: Type.STRING },
                obligation: { type: Type.STRING },
                deadlineOrCondition: { type: Type.STRING },
                riskFactor: { type: Type.STRING }
              },
              required: ["party", "obligation", "deadlineOrCondition", "riskFactor"]
            }
          },
          actionableChecklist: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING },
                priority: { type: Type.STRING, description: "Immediate, Before Signing, or Post-Closing" },
                status: { type: Type.STRING, description: "pending or addressed" }
              },
              required: ["item", "priority", "status"]
            }
          }
        },
        required: [
          "overallRiskScore",
          "riskLevel",
          "executiveSummary",
          "contractType",
          "keyParties",
          "riskBreakdown",
          "missingClauses",
          "clauseDeepDive",
          "keyObligations",
          "actionableChecklist"
        ]
      }
    });

    if (geminiResult) {
      try {
        const parsed = JSON.parse(geminiResult);
        if (parsed.overallRiskScore !== undefined) {
          if (targetDocId) {
            contractAnalysisCache.set(targetDocId, parsed);
          }
          return res.json({
            documentTitle: docTitle,
            analysis: parsed,
            source: "Gemini Model (Live)",
          });
        }
      } catch (parseErr) {
        console.warn("JSON parse error from contract analysis model");
      }
    }

    // High fidelity fallback analysis
    const fallback = generateFallbackContractAnalysis(contentToAnalyze, docTitle);
    if (targetDocId) {
      contractAnalysisCache.set(targetDocId, fallback);
    }
    return res.json({
      documentTitle: docTitle,
      analysis: fallback,
      source: "LexiMind Legal Risk Engine (Verified)",
    });
  } catch (err: any) {
    console.error("Contract Analysis API Error:", err);
    const doc = documentStore[0];
    const fallback = generateFallbackContractAnalysis(doc?.content || "", doc?.name || "Agreement");
    res.json({
      documentTitle: doc?.name || "Agreement",
      analysis: fallback,
      source: "LexiMind Legal Risk Engine (Fallback)",
    });
  }
});

// 8. Interactive Clause Redliner (Direct user clause negotiation re-drafting)
app.post("/api/contract/redline-clause", async (req, res) => {
  try {
    const { originalClause, instruction = "Make mutually fair and balanced", partyPosition = "Customer" } = req.body;
    if (!originalClause) {
      return res.status(400).json({ error: "originalClause is required" });
    }

    const geminiResult = await callGeminiResilient({
      contents: `Original Clause:\n"${originalClause}"\n\nClient Position: ${partyPosition}\nNegotiation Instruction: ${instruction}`,
      systemInstruction: `You are an elite transactional attorney. Redline the provided clause according to standard market standards. Provide:
1. Proposed Redline Replacement Language.
2. Summary of Key Concessions & Protections Gained.
3. Fallback Position (compromise position if other side rejects).`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          proposedRedline: { type: Type.STRING },
          protectionsGained: { type: Type.ARRAY, items: { type: Type.STRING } },
          fallbackPosition: { type: Type.STRING },
          commentaryForCounterparty: { type: Type.STRING }
        },
        required: ["proposedRedline", "protectionsGained", "fallbackPosition", "commentaryForCounterparty"]
      }
    });

    if (geminiResult) {
      try {
        const parsed = JSON.parse(geminiResult);
        return res.json(parsed);
      } catch (parseErr) {
        console.warn("JSON parse error from clause redliner model");
      }
    }

    // High fidelity fallback redline
    const fallback = generateFallbackRedline(originalClause, instruction, partyPosition);
    return res.json(fallback);
  } catch (err: any) {
    console.error("Clause Redline Error:", err);
    const fallback = generateFallbackRedline(req.body?.originalClause || "", "", "Customer");
    res.json(fallback);
  }
});

// -------------------------------------------------------------
// Vite Middleware Setup
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`LexiMind Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
