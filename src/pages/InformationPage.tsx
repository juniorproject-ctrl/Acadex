import {Link} from 'react-router-dom';
import BrandLogo from '../components/BrandLogo';
import {getCurrentUser} from '../lib/auth';
import {formValues,mutate} from '../lib/community';
import {ActionStatus,Field,useAction} from '../components/CommunityUI';
import {Send} from 'lucide-react';
const pages:Record<string,{title:string;sections:string[][]}>={
  "pricing-guide": {
    "title": "Pricing guide",
    "sections": [
      [
        "Setting a price",
        "Compare similar items, consider the original price and condition, and describe damage or missing accessories. Sellers choose their own prices; Acadex does not provide official valuations. All listing and tutoring prices are displayed in AED."
      ],
      [
        "Tutoring prices",
        "Tutors set their availability and session price. Confirm the lesson duration, subject and meeting arrangements before requesting a booking."
      ],
      [
        "Payments and handover",
        "Online checkout is currently test-only. Do not enter real payment details or assume a test payment pays a seller. Real marketplace payments and payouts are not enabled. Arrange buyer pickup or personal seller delivery in chat; Acadex does not arrange courier shipping."
      ],
      [
        "Fees",
        "No live payment-fee schedule is active. Any future platform or payment-provider fees must be shown before you confirm a real purchase."
      ]
    ]
  },
  "safety-tips": {
    "title": "Safety tips",
    "sections": [
      [
        "Protect your account",
        "Never share your password, verification code or password-reset code, including with someone claiming to be Acadex support. Use a unique password and protect your email account with two-step verification."
      ],
      [
        "Meet and inspect",
        "Agree on the item, condition, price, meeting place and time in chat. Choose a safe public location, preferably on campus, and inspect the item. Do not publish your home address or sensitive identity documents in listings."
      ],
      [
        "Avoid payment scams",
        "Be cautious of external payment links, urgent demands, overpayment requests and requests to pay to unlock a refund. Online checkout on Acadex is currently test-only, not a real purchase or escrow service."
      ],
      [
        "Report concerns",
        "Use Report a problem for suspicious listings, abusive messages or account concerns. Keep relevant conversation details and check My reports for the team’s reply. Contact appropriate local services directly if there is an immediate safety risk."
      ]
    ]
  },
  "terms-of-service": {
    "title": "Terms of service",
    "sections": [
      [
        "About Acadex",
        "Acadex provides a campus marketplace and learning community. Listings, tutoring availability, study groups and uploaded resources are provided by users. Acadex is not a university, courier service, or guarantor of a seller’s item or a tutor’s results."
      ],
      [
        "Accounts",
        "Use an email address you control and provide accurate information. Student registration requires a supported university email; administrators are provisioned separately. Keep your credentials private. Tutor access requires application review."
      ],
      [
        "Acceptable content",
        "Only list items you are entitled to sell and share resources you have permission to distribute. Do not publish stolen goods, confidential examinations, copyrighted material without permission, personal identity documents, harassment, misleading claims or other unlawful content. Follow your university’s academic-integrity rules."
      ],
      [
        "Transactions and services",
        "The current online checkout is a test environment and does not create real purchases or seller payouts. Buyers and sellers arrange pickup or personal seller delivery themselves. Do not treat a test confirmation as payment. Future live payment, cancellation and refund terms must be published before real transactions are enabled."
      ],
      [
        "Moderation",
        "The Acadex team may review reports, hide or remove inappropriate content, restrict accounts and approve or decline tutor applications. Contact the team if you want a moderation decision reviewed."
      ],
      [
        "Account closure",
        "You can request account deletion in Settings after resolving pending obligations. Login credentials and profile identifiers are removed from the account; relevant conversation, transaction and moderation history may remain. See the privacy policy for the limits of deletion."
      ],
      [
        "Questions and changes",
        "Use Contact us for questions about these terms. Material changes should be communicated before they take effect. These terms describe current operations and require owner and legal review before a commercial launch."
      ]
    ]
  },
  "privacy-policy": {
    "title": "Privacy policy",
    "sections": [
      [
        "Information we process",
        "We process account name and email, a hashed password, verification/reset records, roles, listings and images, learning activity, messages, reports, tutor applications, feedback and support requests. Payment testing stores order references and statuses, not card details in Acadex."
      ],
      [
        "Why we use it",
        "We use this information to authenticate users, display their content, deliver requested emails, operate chat and learning features, review applications and reports, handle support, and protect the service."
      ],
      [
        "Who can see it",
        "Listings and learning profiles are visible to signed-in users. Marketplace conversations are accessible through the app to their participants; authorised operational access to stored data may be necessary for support or investigations. Administrators can review reports, applications and support requests. Do not place sensitive personal information in public descriptions or messages."
      ],
      [
        "Service providers",
        "Railway hosts the application and database. Cloudflare provides domain/DNS services and may proxy traffic depending on configuration. Resend or the configured mail provider handles outgoing emails. Stripe handles enabled test-checkout data. These providers process information needed for their services and may operate outside the UAE."
      ],
      [
        "Browser storage",
        "Your browser stores the access token, a small account summary and accessibility preferences. Passwords are not saved in browser storage by the current application. Signing out removes the local session; sign out everywhere revokes existing account tokens on the server."
      ],
      [
        "Deletion and retention",
        "Deleting an account removes its name, original email, password hash and login access, and withdraws public listings. A non-login record and relevant transaction, conversation and moderation history can remain. Existing backups, copied content and files may not disappear immediately. Contact us for access, correction, broader deletion requests or questions about retained information. Retention and provider arrangements require owner review before commercial launch."
      ],
      [
        "Your choices",
        "Edit your name in Settings, change your password, sign out all devices, adjust browser accessibility settings, or delete your account. Contact the Acadex team with privacy requests. Never include passwords or verification codes in a request."
      ]
    ]
  },
  "help": {
    "title": "Help center",
    "sections": [
      [
        "Account and verification",
        "Register with your university email and verify the code sent to your mailbox. Check spam if a code is missing. Use Forgot password to recover a verified account. A valid email domain does not prove you own a mailbox; the code verifies access."
      ],
      [
        "Selling and messaging",
        "Open Post a Listing, add your item details and photos, and choose buyer pickup, personal seller delivery or both. Open My listings from the account menu to edit or delete your items. Pending or paid checkouts can restrict changes. Use Messages to arrange details with a buyer or seller."
      ],
      [
        "Learning resources",
        "Use the university, major and course selectors to find resources. Simple subject labels group related records and are not official university curricula. Tutor bookings require the tutor to accept or decline your request. Study-group owners manage sessions and announcements."
      ],
      [
        "Payments",
        "Online checkout is currently for testing only. It does not pay a seller or confirm a real purchase. Never enter real payment details in a test checkout."
      ],
      [
        "Reports and support",
        "Use Report a problem while signed in, then check My reports for status and replies. Contact us is available for general support, including if you cannot sign in. Feedback is for suggestions and testing comments."
      ],
      [
        "Closing an account",
        "Settings includes password changes, sign-out from all devices and account deletion. Resolve pending bookings and checkouts first. Group owners can contact support to close or transfer their groups before deletion."
      ]
    ]
  }
};
const links=[['help','Help center'],['contact','Contact us'],['pricing-guide','Pricing guide'],['safety-tips','Safety tips'],['terms-of-service','Terms of service'],['privacy-policy','Privacy policy']];
export default function InformationPage({page}:{page:string}){
  const content=pages[page],action=useAction();
  return <div className="community-page" style={{maxWidth:900}}>
    <header className="flex flex-wrap justify-between items-center gap-4 mb-8"><BrandLogo size="sm"/><Link className="text-link" to={getCurrentUser()?'/home':'/'}>{getCurrentUser()?'Back to Acadex':'Sign in'}</Link></header>
    <nav aria-label="Support pages" className="flex flex-wrap gap-x-5 gap-y-3 border-b border-gray-200 pb-5 mb-8">{links.map(([path,label])=><Link key={path} to={'/'+path} className="text-link" aria-current={page===path?'page':undefined}>{label}</Link>)}</nav>
    <h1 className="text-3xl mb-6">{page==='contact'?'Contact us':content?.title}</h1>
    {content?.sections.map(([heading,body])=><section className="detail-section" key={heading}><h2>{heading}</h2><p className="preserve-lines leading-relaxed">{body}</p></section>)}
    {page==='contact'&&<><p>Send the Acadex team a support request. Use an email address you can receive replies at.</p>
    <form className="editor-form" onSubmit={e=>{e.preventDefault();const form=e.currentTarget,body=formValues(form);void action.run(async()=>{await mutate('/support',body);form.reset();},'Your message has been saved for the Acadex team. Replies will be sent to the email you provided.');}}>
      <Field label="Name"><input name="name" required minLength={2} maxLength={100} autoComplete="name"/></Field>
      <Field label="Email for replies"><input name="email" type="email" required maxLength={255} autoComplete="email"/></Field>
      <Field label="Subject"><input name="subject" required minLength={3} maxLength={160}/></Field>
      <Field label="Message"><textarea name="message" rows={6} required minLength={10} maxLength={5000}/></Field>
      <p className="muted">Do not send passwords, verification codes, bank details or identity documents. This form is not monitored as an emergency service.</p>
      <button className="action-button" disabled={action.busy}><Send size={17}/>{action.busy?'Sending...':'Send message'}</button><ActionStatus action={action}/>
    </form></>}
  </div>;
}

