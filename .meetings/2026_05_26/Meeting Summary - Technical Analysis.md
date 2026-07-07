# Meeting Summary - Technical Analysis
## Calares OMS Cloud Migration Discussion
**Date:** May 20, 2026

---

## Executive Summary
Discussion regarding migration of Calares' Sterling OMS from on-premise to IBM SaaS cloud environment, including cost analysis, implementation timeline, and technical considerations.

---

## Key Deliverables

### 1. **Cloud Migration Implementation**
- **Scope:** Full Sterling OMS migration to IBM SaaS platform
- **Estimated Cost:** $1.0M - $1.5M (one-time implementation)
- **Timeline:** 3-6 months implementation period
- **Components:**
  - Sterling OMS platform migration
  - Customization untangling and refactoring
  - Integration testing and validation
  - Knowledge transfer to functional analysts

### 2. **Annual Licensing & Support**
- **Current On-Premise Cost:** ~$547K/year (renewal September 1st)
- **Proposed SaaS Cost:** ~$825K/year (50% uplift)
- **License Coverage:** 20.5-21 million order lines
- **Includes:** Three part numbers (Call Center, Sterling OMS, bulk space allocation)

### 3. **Partner Support Services**
- **Current Annual Spend:** ~$230K with Lightwell
- **Proposed Budget:** $100K/year for ongoing partner support
- **Rationale:** Reduced need with IBM direct support access

### 4. **Hardware Considerations**
- **Current:** On-premise Linux servers
- **Future:** Eliminated with SaaS migration
- **Estimated Savings:** $2.5M - $3M over 5-year lease term
- **Infrastructure Team:** In-house team currently manages Linux environment

---

## Timeline & Milestones

### Immediate (Current State)
- **Issue:** Web.xml configuration problems blocking deployment
- **Status:** Patches introduced breaking changes
- **Action Required:** Technical call with Lightwell to resolve deployment blockers
- **Stakeholders:** Tony, Kathy (technical lead for OMS), Angie, Sandy

### Short-term (Next 7 Weeks)
- **Renewal Decision:** September 1st deadline approaching
- **Cost Analysis:** Finalize hardware costs and actual order line volumes
- **Proposal Development:** Detailed scoping with IBM Expert Labs team

### Implementation Phase (3-6 Months)
- **Month 1-2:** Environment assessment and customization analysis
- **Month 3-4:** Migration execution and testing
- **Month 5-6:** Validation, training, and cutover
- **Parallel Running:** 1-year grace period where on-premise runs at no charge during cloud adoption

### Post-Implementation
- **Year 1:** Stabilization period with potential for rollback if needed
- **Year 2+:** Consider additional modules (Store module, Intelligent Promising/SIP)
- **Ongoing:** Quarterly business reviews and optimization

---

## SWOT Analysis

### Strengths
1. **Existing Infrastructure Knowledge**
   - Team familiar with Sterling OMS functionality
   - Functional analysts (Sandy, Sean, Lim) already trained
   - Established processes and workflows

2. **IBM Direct Support Access**
   - Direct access to Sterling support tickets
   - Functional question support included in SaaS
   - Reduced dependency on third-party partners

3. **Upgrade Management**
   - IBM handles all upgrades and patches
   - No manual deployment process required
   - Eliminates current web.xml configuration issues

4. **Risk Mitigation**
   - 1-year parallel running period
   - Ability to rollback to on-premise if needed
   - No forced commitment beyond evaluation period

### Weaknesses
1. **Higher Annual Costs**
   - 50% increase in software licensing ($547K → $825K)
   - Net savings only ~$125K/year after hardware elimination
   - Long ROI payback period on $1-1.5M implementation

2. **Implementation Complexity**
   - Customization untangling required
   - Potential impact on integrated systems
   - 3-6 month disruption to business operations

3. **Current Technical Issues**
   - Unresolved web.xml deployment problems
   - Patch management challenges
   - Support ticket delays and back-and-forth

4. **Resource Constraints**
   - Memorial Day rush timing pressure
   - Limited technical staff (Kathy covers multiple products)
   - Functional analysts not reducing FTE needs

### Opportunities
1. **Additional Modules**
   - Store module for HD orders and enhanced flexibility
   - Intelligent Promising (SIP) for expected arrival dates
   - E-commerce feature enhancements

2. **Operational Efficiency**
   - Eliminate manual deployment processes
   - Reduce partner dependency over time
   - Faster issue resolution with direct IBM support

3. **Scalability**
   - Cloud-native architecture
   - Easier capacity adjustments
   - Modern platform for future growth

4. **Technical Debt Reduction**
   - Force customization cleanup
   - Standardize on best practices
   - Improve system maintainability

### Threats
1. **Migration Risk**
   - Potential business disruption during 3-6 month implementation
   - Integration failures with other systems
   - Data migration challenges

2. **Cost Overruns**
   - Implementation could exceed $1.5M estimate
   - Hidden customization complexity
   - Extended timeline increasing costs

3. **Vendor Lock-in**
   - Increased dependency on IBM SaaS platform
   - Limited control over upgrade timing
   - Potential future price increases

4. **Change Management**
   - Team resistance to new platform
   - Learning curve for cloud-based operations
   - Business partner adaptation required

---

## Technical Considerations

### Current Environment
- **Platform:** Linux servers (on-premise)
- **Order Volume:** 20.5-21M order lines annually
- **Integration:** AS/400 with IBM i (core retail/Ear key system)
- **Support Model:** Lightwell partner + in-house infrastructure team

### Migration Requirements
1. **Customization Assessment**
   - Identify all custom code and configurations
   - Determine what can be eliminated vs. must be migrated
   - Impact analysis on downstream systems

2. **Integration Points**
   - Core retail system connections
   - E-commerce platform integrations
   - Third-party system interfaces

3. **Data Migration**
   - Historical order data
   - Configuration and setup data
   - User accounts and permissions

4. **Testing Strategy**
   - Functional testing with business analysts
   - Integration testing with connected systems
   - Performance testing under peak loads

---

## Financial Summary

### Year 1 Costs
- Implementation: $1,000,000 - $1,500,000
- SaaS Licensing: $825,000
- Partner Support: $100,000
- **Total Year 1:** $1,925,000 - $2,425,000

### Ongoing Annual Costs (Year 2+)
- SaaS Licensing: $825,000
- Partner Support: $100,000
- **Total Annual:** $925,000

### Current Annual Costs
- On-Premise Licensing: $547,000
- Partner Support (Lightwell): $230,000
- Hardware (amortized): ~$500,000 - $600,000
- **Total Current:** $1,277,000 - $1,377,000

### Net Annual Savings
- **Estimated:** $125,000 - $450,000/year (depending on actual hardware costs)
- **ROI Period:** 3-5 years to recover implementation costs

---

## Recommendations

1. **Immediate Actions**
   - Resolve current web.xml deployment issues with Lightwell
   - Gather accurate hardware and infrastructure costs
   - Validate actual order line volumes for licensing

2. **Decision Timeline**
   - Complete detailed scoping by end of June
   - Make go/no-go decision by mid-July
   - Allow 2 weeks for contract negotiations before September 1st renewal

3. **Risk Mitigation**
   - Negotiate fixed-price implementation contract
   - Establish clear rollback criteria and process
   - Maintain on-premise environment during 1-year evaluation

4. **Future Considerations**
   - Defer Store module and SIP until post-stabilization (Year 2)
   - Plan for functional analyst training on cloud platform
   - Evaluate alternative partner options for ongoing support

---

## Open Questions

1. What are the exact hardware costs (purchase + maintenance)?
2. What is the actual annual order line volume trend?
3. Which customizations are business-critical vs. nice-to-have?
4. What are the integration dependencies with other systems?
5. Can implementation be scoped to lower end of $1M estimate?
6. What are the specific SLAs and support terms in SaaS contract?

---

## Next Steps

1. Schedule technical deep-dive with IBM Expert Labs and Jim (technical lead)
2. Compile list of questions for Lightwell regarding current issues
3. Obtain detailed hardware cost breakdown from infrastructure team
4. Review last 12 months of Lightwell invoices for accurate support costs
5. Engage Kathy and Tony in upcoming technical calls
6. Develop formal proposal with detailed scope and pricing