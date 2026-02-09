'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function TermsPage() {
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null)
  const [brokerName, setBrokerName] = useState<string>('VALOREN')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadBrokerData = async () => {
      try {
        let logoUrl: string | null = null
        let name: string | null = null
        if (supabase) {
          try {
            const { data: d1 } = await supabase.from('platform_settings').select('value').eq('key', 'broker_logo_dark').single()
            if (d1?.value) { logoUrl = d1.value as string; localStorage.setItem('broker_logo_dark', logoUrl) }
            else { const { data: d2 } = await supabase.from('platform_settings').select('value').eq('key', 'broker_logo').single(); if (d2?.value) { logoUrl = d2.value as string; localStorage.setItem('broker_logo', logoUrl) } }
            const { data: d3 } = await supabase.from('platform_settings').select('value').eq('key', 'broker_name').single()
            if (d3?.value) { name = d3.value as string; localStorage.setItem('broker_name', name) }
          } catch { /* fallback */ }
        }
        if (!logoUrl) logoUrl = localStorage.getItem('broker_logo_dark') || localStorage.getItem('broker_logo')
        if (!name) name = localStorage.getItem('broker_name')
        if (logoUrl) setBrokerLogo(logoUrl)
        if (name) setBrokerName(name)
      } catch { /* ignore */ }
    }
    loadBrokerData()
  }, [])

  return (
    <div ref={scrollRef} className="h-screen w-full overflow-y-auto overflow-x-hidden bg-[#060b18] text-white scroll-smooth">
      <header className="sticky top-0 z-50 bg-[#060b18]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {brokerLogo ? <img src={brokerLogo} alt={brokerName} className="h-7 object-contain" /> : <span className="text-lg font-bold text-white">{brokerName}</span>}
          </Link>
          <Link href="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"><ArrowLeft className="w-4 h-4" />Back</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">General Terms and Conditions</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: January 2025</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-gray-300 leading-relaxed [&_h2]:text-white [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:text-white [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3 [&_strong]:text-white [&_ol]:space-y-3 [&_ul]:space-y-2 [&_li]:text-gray-400">

          <p>
            These Terms &amp; Conditions (hereinafter referred to as the &quot;Agreement&quot;) shall regulate the legal
            relationship between Sun Wave LLC operating the global brand <strong>{brokerName}</strong> with company
            No. L 22402 and registered at the Lighthouse Trust Nevis Ltd, Suite 1, A.L. Evelyn Ltd Building,
            Main Street, Charlestown, Nevis (hereinafter referred to as the &quot;Company&quot;), and the user (a
            natural or legal entity) (hereinafter referred to as the &quot;Client&quot;) of the Website.
          </p>

          <ol className="list-decimal pl-5">
            <li>The Client confirms that he/she has read, understood and accepted all information, conditions and terms set out on the Website which are open to be reviewed and can be examined by the public and which include important legal Information.</li>
            <li>By accepting this Agreement, the Client agrees and irrevocably accepts the terms and conditions contained in this Agreement, its annexes and/or appendices as well as other documentation/information published on the Website, including without limitation the Privacy Policy, Payment Policy, Withdrawal Policy, Code of Conduct, Order Execution Policy and Anti-Money Laundering Policy. The Client accepts this Agreement by registering an Account on the Website and depositing funds. By accepting the Agreement, and subject to the Company&apos;s final approval, the Client enters into a legal and binding agreement with the Company.</li>
            <li>The terms of this Agreement shall be considered accepted unconditionally by the Client upon the Company&apos;s receipt of an advance payment made by the Client. As soon as the Company receives the Client&apos;s advance payment, every operation made by the Client on the Trading Platform shall be subject to the terms of this Agreement and other documentation/information on the Website.</li>
            <li>The Client hereby acknowledges that each and any Operation, activity, transaction, order and/or communication performed by him/her on the Trading Platform, including without limitation through the Account, and the Website, shall be governed by and/or must be executed in accordance with the terms and conditions of this Agreement and other documentation/information on the Website.</li>
            <li>By accepting this current agreement, the Client confirms that he/she is able to receive information, including amendments to the present Agreement, either via email or through the Website.</li>
          </ol>

          <h2>1. Terms</h2>
          <ol className="list-decimal pl-5">
            <li><strong>Account</strong> – means a unique personified account registered in the name of the Client and which contains all the Client&apos;s transactions/operations on the Trading Platform of the Company.</li>
            <li><strong>Ask</strong> – means the higher price in a quote. The price the Client may buy at.</li>
            <li><strong>Bid</strong> – means the lower price in a quote. The price the Client may sell at.</li>
            <li><strong>Turbo Options and/or All or Nothing Options</strong> – means financial instruments where a prediction is made on the direction of the price movement of an asset at a certain period of the day. The payout is pre-determined as a fixed amount whether the option expires in the money or if the option expires out of the money.</li>
            <li><strong>CFD (contract for difference)</strong> – means a tradable contract entered into between the Client and the Company, who exchange the difference in the value of an Instrument, as specified on the Trading Platform at the time of opening a Transaction, and the value of that Instrument at the contract&apos;s end.</li>
            <li><strong>Digital Option Contract</strong> – means a type of derivative instrument where the Client earns a payout if they correctly predict the price movement of the underlying asset at the time of the option&apos;s expiry.</li>
            <li><strong>Execution</strong> – means the execution of Client order(s) by the Company acting as the Client&apos;s counterparty as per the terms of the present agreement.</li>
            <li><strong>Financial Instruments</strong> – means the Financial Instruments as per paragraph 2.4 below that are available on the Company&apos;s Trading Platform.</li>
            <li><strong>KYC documents</strong> – means the documents to be provided by the Client, including without limitation a copy of the passport or ID and utility bill of the Client.</li>
            <li><strong>Market</strong> – means the market on which the Financial Instruments are subject to and/or traded on, whether this market is organized/regulated or not and whether it is in the relevant jurisdiction or abroad.</li>
            <li><strong>Market Maker</strong> – means a company which provides BID and ASK prices for financial instruments.</li>
            <li><strong>Operations</strong> – means actions performed at the Client&apos;s Account, following an order placed by the Client, connected with but not limited to crediting of funds, return of funds, opening and closing of trade transactions/positions.</li>
            <li><strong>Prices</strong> – means the prices offered to the Client for each transaction, which may be changed without prior notice.</li>
            <li><strong>Services</strong> – means the services described in section 2 of this Agreement through the Trading Platform.</li>
            <li><strong>Spread</strong> – means the difference between the purchase price Ask (rate) and the sale price Bid (rate) at the same moment.</li>
            <li><strong>Trading Platform</strong> – means an electronic system on the internet that consists of all programs and technology that present quotes in real-time, allow the placement/modification/deletion of orders and calculate all mutual obligations of the Client and the Company.</li>
            <li><strong>Introducing Broker</strong> – means any person who wishes to refer Clients to the Company and has entered into an Introducing Broker Agreement.</li>
            <li><strong>Serviced Countries</strong> – means any country available for registration on the Company&apos;s Website (e.g Brazil).</li>
          </ol>

          <h2>2. Subject of the Agreement and Services</h2>
          <ol className="list-decimal pl-5">
            <li>The subject of the Agreement shall be the provision of Services to the Client by the Company under the Agreement and through the Trading Platform.</li>
            <li>The Company shall carry out all transactions as provided in this Agreement on an execution-only basis, neither managing the account nor advising the Client. The Company is entitled to execute transactions requested by the Client as provided in this Agreement, even if the transaction is not beneficial for the Client.</li>
            <li>The Investment and Ancillary Services which the Company should provide under the terms of the Agreement include: <strong>Investment Services:</strong> Reception and transmission of orders; Execution of orders on behalf of Clients; Dealing on Own Account. <strong>Ancillary Services:</strong> Safekeeping and administration of Financial Instruments; Granting credits or loans; Foreign exchange services connected to Investment Services. The Company does not provide investment, tax or trading advice.</li>
            <li><strong>Financial Instruments</strong> (not exhaustive): Option contracts (Digital Options and/or Turbo Options) in stocks, commodities, indices and currency pairs; Financial Contracts for Difference (CFDs) in stocks, currency pairs (FX), commodities, ETFs, indices and CFDs in cryptocurrencies.</li>
          </ol>
          <p className="text-gray-500 text-xs border-l-2 border-white/10 pl-4">Trading in CFDs and other derivatives does not give you any right, voting right, title or interest in the underlying instrument of the Transaction. The Company reserves the right to impose expiration times: daily/weekly/monthly and/or no expiration at all.</p>

          <h2>3. General Provisions</h2>
          <ol className="list-decimal pl-5">
            <li>Subject to the provisions of this Agreement, the Company agrees to provide the Client with the Services subject to the Client: (a) being of age of maturity; (b) not residing in any country where provision of the services would be contrary to local laws; (c) not being a citizen of USA/territories of the US, North Korea, Palestine, Vatican and/or a resident of non-serviced countries as listed in the full Agreement.</li>
            <li>The Company will offer Services at its absolute discretion, subject to the provisions of this Agreement.</li>
            <li>The Client is prohibited from executing transactions that would exceed the total balance deposited in his/her Account.</li>
            <li>The Company shall facilitate the execution of trade activities but shall not provide trust services or trading advisory services.</li>
            <li>The Company shall process all transactions on an execution-only basis.</li>
            <li>The Company shall process orders regardless of whether they are beneficial for the Client.</li>
            <li>The Company shall not be financially liable for any operations conducted by the Client.</li>
            <li>Each Client shall be the only authorized user of the Account. The Client is granted an exclusive and non-assignable right to the use of the Account.</li>
            <li>The Client shall be liable for all orders given through his security information.</li>
            <li>If the Client acts on behalf of any third party, the Company shall not accept this person as a Client.</li>
            <li>The Client has the right to cancel his order within 3 seconds after giving such order (&quot;Cancellation&quot;). The cancellation option is available as long as the price remains unchanged.</li>
            <li>The Client is entitled to use Cancellation or Buyout subject to conditions specified on the Trading Platform, including any applicable fees.</li>
            <li>The Company may from time to time utilize a third party to hold the Client&apos;s funds. These funds will be held in segregated accounts.</li>
            <li>Provision of investment advice shall only be carried out subject to a separate written agreement with the Client.</li>
          </ol>

          <h2>4. Execution of Orders / Electronic Trading</h2>
          <ol className="list-decimal pl-5">
            <li>The Client accepts that some orders shall be executed by the Company as the counterparty in its capacity of Market Maker. The Client is informed that Conflicts of Interest may arise because of this model.</li>
            <li>The Company shall execute the Client&apos;s orders sequentially and promptly.</li>
            <li>The Client acknowledges the risk of mistakes or misinterpretations in orders sent through the Trading Platform due to technical or mechanical failures.</li>
            <li>The Company shall have no responsibility as to the content of orders or the identity of the person placing the order, except where there is gross negligence, willful default or fraud.</li>
            <li>The Company shall not take action based on orders transmitted by electronic means other than the predetermined ones (the Trading Platform).</li>
            <li>The Company shall bear no responsibility for financial losses arising from the use of external trading bots.</li>
            <li>Products or services offered by the Company may not always be available, at the Company&apos;s absolute discretion.</li>
            <li>Regarding corporate actions: the Company reserves the right to close positions related to assets of companies in bankruptcy proceedings or subject to stock splits.</li>
            <li>The Company may refuse to execute orders in cases of market manipulation, insider trading, money laundering, insufficient funds, breach of obligations, or internal exposure limits.</li>
            <li>Any refusal by the Company shall not affect any obligation which the Client may have towards the Company.</li>
          </ol>

          <h2>5. Limitation of Liability</h2>
          <ol className="list-decimal pl-5">
            <li>The Company does not guarantee uninterrupted service, safe and errors-free, and immunity from unauthorized access to trading servers.</li>
            <li>Supplying services depends on third parties and the Company bears no responsibility for actions or omissions of third parties.</li>
            <li>The Company will bear no responsibility for damage involving force majeure or events beyond its control.</li>
            <li>Under no circumstances will the Company hold responsibility for direct or indirect damages of any kind.</li>
            <li>If a Client registers through an Introducing Broker or third parties, the Company shall not be responsible for any agreement between the Client and these persons.</li>
          </ol>

          <h2>6. Settlement of Transactions</h2>
          <ol className="list-decimal pl-5">
            <li>The Company shall proceed to a settlement of all transactions upon execution.</li>
            <li>An online statement of Account will be available for printing on the Trading Platform at all times.</li>
          </ol>

          <h2>7. Rights, Obligations and Guarantees of the Parties</h2>
          <h3>7.1 The Client shall be entitled to:</h3>
          <ol className="list-[lower-alpha] pl-5">
            <li>Submit orders requesting execution of transactions on the Website;</li>
            <li>Request withdrawal of amounts subject to the Withdrawal Policy;</li>
            <li>Submit complaints to <strong>support@valorenbroker.com</strong>. The Company shall respond within a reasonable amount of time (within 3 months);</li>
            <li>Unilaterally terminate the Agreement provided there is no outstanding debt.</li>
          </ol>

          <h3>7.2 The Client:</h3>
          <ol className="list-[lower-alpha] pl-5">
            <li>Acknowledges that the Account shall be activated upon deposit of funds;</li>
            <li>Warrants compliance with all terms and conditions;</li>
            <li>Warrants that username and password will only be used by him/her;</li>
            <li>Shall be liable for all orders submitted through his/her security information;</li>
            <li>Accepts the risk of unauthorized access and agrees to indemnify the Company;</li>
            <li>Confirms that trading strategies are made with awareness of all risks involved;</li>
            <li>Shall register only 1 (one) Account;</li>
            <li>Accepts full responsibility for tax obligations in his/her jurisdiction;</li>
            <li>Will provide KYC documents within 7 days from depositing funds;</li>
            <li>Confirms the purpose of the Account is to trade on his/her personal behalf.</li>
          </ol>

          <h3>7.3 Client Warranties</h3>
          <p>The Client warrants: not residing in restricted countries; possessing legal capacity; not being a citizen/resident of non-serviced countries; funds are not connected to illegal activities; information provided is accurate, complete and true.</p>

          <h3>7.4 The Company shall be entitled to:</h3>
          <ol className="list-[lower-alpha] pl-5">
            <li>Modify financial obligations in case of violation of this Agreement;</li>
            <li>Change option payment rates, return rates, minimum/maximum amounts;</li>
            <li>Contact the Client regarding the Agreement;</li>
            <li>Unilaterally modify the terms, notifying the Client through the Website;</li>
            <li>Engage third parties to facilitate or enhance the Services;</li>
            <li>Request additional supporting documents during Account verification.</li>
          </ol>

          <h2>8. Indemnity and Liability</h2>
          <ol className="list-decimal pl-5">
            <li>The Client shall indemnify and keep indemnified the Company against all direct or indirect liabilities, unless such liabilities result from gross negligence, willful default or fraud by the Company.</li>
            <li>The Company shall not be liable for any direct/indirect loss unless it results from gross negligence, willful default or fraud.</li>
            <li>The Company shall not be liable for any loss of opportunity or decrease in value of financial instruments.</li>
            <li>The Company shall not be liable for loss resulting from misrepresentation of facts or error in judgment.</li>
            <li>The Company shall not be liable for acts, omissions or insolvency of any counterparty, bank or third party.</li>
          </ol>

          <h2>9. Personal Data</h2>
          <ol className="list-decimal pl-5">
            <li>The Client irrevocably consents to the collection and processing of personal data by the Company.</li>
            <li>The Client shall provide correct, accurate and complete personal data.</li>
            <li>The purpose of collecting data is to comply with applicable regulations, including anti-money laundering.</li>
            <li>The Company may collect, record, store, adjust, use, transfer, anonymize, block, delete and destroy personal data.</li>
            <li>Personal data will be stored for a minimum of 7 years following termination of the Agreement.</li>
            <li>The Client consents to disclosure of personal data to third parties solely for purposes of the Agreement.</li>
            <li>The Company shall not make personal data public except as required by applicable laws.</li>
            <li>The Company shall take necessary measures to protect personal data from unauthorized access.</li>
          </ol>

          <h2>10. Assignment</h2>
          <ol className="list-decimal pl-5">
            <li>The Client shall not be entitled to assign or transfer any rights or obligations under this Agreement.</li>
            <li>The Company may assign or transfer rights or obligations to a third party, with notification to the Client.</li>
          </ol>

          <h2>11. Risk Statement</h2>
          <p>The Client confirms to have read, understood and accepted the risk statement relating to the use of Services on the Website. By accepting this Agreement, the Client accepts the Company&apos;s general description of the nature and risks of different Financial Instruments.</p>

          <h2>12. One-Click Trading Terms and Conditions</h2>
          <ol className="list-decimal pl-5">
            <li>One-Click Trading mode allows you to perform trading operations with only one click on Buy/Call or Sell/Put buttons, without additional confirmations.</li>
            <li>By opting in, you acknowledge that you have read and understood these terms.</li>
            <li>There will be no subsequent confirmation prompt; ensure all parameters are set beforehand.</li>
            <li>You can activate or deactivate One-Click Trading in the platform settings.</li>
            <li>You agree to accept all risks associated with this mode, including errors, omissions or mistakes.</li>
            <li>You agree to fully indemnify the Company from any losses resulting from such errors.</li>
          </ol>

          <h2>13. Charges and Fees</h2>
          <ol className="list-decimal pl-5">
            <li>The Company shall be entitled to receive fees from the Client regarding Services provided.</li>
            <li>The Company may pay fees/commissions to Introducing Brokers or third parties based on written agreements.</li>
            <li>Ongoing trading fees, including swaps, shall be charged and deducted from the Client&apos;s balance.</li>
            <li>Amounts sent by the Client will be deposited net of any charges by banks or intermediaries.</li>
          </ol>

          <h2>14. Governing Law</h2>
          <ol className="list-decimal pl-5">
            <li>This Agreement shall be governed by the laws of Saint Kitts and Nevis.</li>
            <li>The Company and Clients irrevocably submit to the jurisdiction of the courts of Saint Kitts and Nevis.</li>
            <li>The Company shall be entitled to use interpreter services during court proceedings.</li>
          </ol>

          <h2>15. Duration and Termination of the Agreement</h2>
          <ol className="list-decimal pl-5">
            <li>The Agreement shall be concluded for an indefinite term.</li>
            <li>The Agreement comes into force when the Client accepts it and makes an advance payment.</li>
            <li>In case of discrepancies between English and translated versions, the English text shall prevail.</li>
            <li>The Agreement may be terminated: (A) by either Party with 15 days written notice; (B) by the Company immediately in cases including: death or incapacity; violation of terms; age non-compliance; citizenship/residency of non-serviced countries; suspected fraud, market manipulation, bad faith; criminal offence; failure to provide KYC documents within 14 days; use of VPN/different IPs; chargebacks; high-frequency trading manipulation; third-party funding violations.</li>
            <li>In case of termination under clause 15.4.B, the Company shall have no liability towards the Client.</li>
            <li>In case of termination under clause 15.4.A, the Company shall wire the remaining balance to the Client.</li>
          </ol>

          <h2>16. Terms and Conditions for 1-Click Service</h2>
          <ol className="list-decimal pl-5">
            <li>The Client agrees to deposit funds to use the Company&apos;s Services.</li>
            <li>Payment is considered processed and cannot be returned after clicking the &quot;Payment&quot; button.</li>
            <li>The Client accepts that payment processing is executed by a third-party Provider.</li>
            <li>1-click deposits are not processed as 3-D secure transactions unless the client enables 3-D secure.</li>
            <li>The Provider shall not be liable for refusal to process the Client&apos;s payment card data.</li>
          </ol>

          <h2>Annex 1 – General Terms (Technical Regulation)</h2>

          <h3>1. Client&apos;s Responsibility</h3>
          <p>The Client acknowledges these General Terms are an integral part of this Agreement. It is the Client&apos;s responsibility to verify that all transactions comply with applicable law. The Client is responsible for securing his/her credentials. No Account will be approved without completion of compliance procedures.</p>

          <h3>2. Risks</h3>
          <p>The value of Financial Instruments may increase or decrease. CFD Trading does not give you any right to the underlying instrument. Virtual currencies are complex and high-risk products. The Client acknowledges having read the Company&apos;s risk disclosure.</p>

          <h3>3. Financial Information</h3>
          <p>The Company shall not be held responsible for losses due to inaccurate or erroneous financial information on the Website. The Client should verify accuracy of information.</p>

          <h3>4. Processing of Trade Requests and Orders</h3>
          <p>Orders undergo correctness tests on the Trading Platform and server. Processing time normally varies between 0–4 seconds in normal market conditions.</p>

          <h3>5. Quotes</h3>
          <p>The only reliable source of quote flow information is the main server. Graphs on the Trading Platform are indicative. Price is formed by the formula (Bid+Ask)/2. In case of Non-market quotes, the Company may correct the financial result or cancel it.</p>

          <h3>6. Copyright</h3>
          <p><strong>{brokerName}</strong> is a global brand operated by Sun Wave LLC. The Company is the owner of all intellectual property rights on and throughout the Website. The use of the <strong>{brokerName}</strong> brand without the Company&apos;s express written pre-approval is strictly prohibited.</p>

          <h3>7. Content and Third Parties&apos; Websites</h3>
          <p>The Company does not provide investment research. All information published is of a promotional/marketing nature only. The Company will not be liable for content of third-party websites.</p>

          <h3>8–9. Processing of Client Orders</h3>
          <p>Positions are opened only if available funds are sufficient. Closing occurs at the current price at the trading server at the moment of closing.</p>

          <h3>10. OTC Assets</h3>
          <p>OTC assets are traded outside the regular market. Their price is formed from trade requests and orders of Clients. The Client acknowledges understanding the pricing algorithm.</p>

          <h3>11. Fraud</h3>
          <p>If the Company has reasonable suspicion of fraud (credit card fraud, software manipulation, system exploitation), it shall be entitled to block the Client&apos;s account without prior notice and/or terminate the Agreement.</p>

          <h3>12. Benefits</h3>
          <p>The Company may provide benefits including VIP status at its absolute discretion. Benefits may be amended or cancelled at any time. Abuse of privileges is prohibited. The client may request to stop receiving Benefits at <strong>support@valorenbroker.com</strong>.</p>

          <h3>13. Foreign Exchange</h3>
          <p>For any conversion required, the Company may debit the Client&apos;s Account with the equivalent amount. The Client acknowledges and agrees to undertake all risks deriving from any such conversion, including the risk of loss from exchange rate fluctuations.</p>

          <div className="border-t border-white/10 pt-8 mt-12">
            <p className="text-gray-600 text-xs">{brokerName} &copy; 2025 — All rights reserved. Sun Wave LLC. Lighthouse Trust Nevis Ltd, Suite 1, A.L. Evelyn Ltd Building, Main Street, Charlestown, Nevis. Company No. L 22402.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
