import React, { type FC } from 'react';
import { Heading, Section, Text } from '@react-email/components';
import { EMAIL_COLORS, EMAIL_FONTS } from '@notification/constants/email-theme';
import { BaseTranslations, getDefaultTranslations } from '@notification/i18n';
import { EmailHeader, EmailLayout } from '@notification/templates/components';

export interface OtpEmailProps {
   fullName?: string;
   otpCode?: string;
   expiresInMinutes?: number;
   translations?: BaseTranslations;
}

export const OtpEmail: FC<OtpEmailProps> = ({ fullName, otpCode = '123456', expiresInMinutes = 10, translations }) => {
   const currentTranslations = translations || getDefaultTranslations();
   const t = currentTranslations.otp;
   const common = currentTranslations.common;

   const greeting = fullName ? t.greeting.replace('{fullName}', fullName) : 'Hello,';
   const preview = t.preview.replace('{otpCode}', otpCode);
   const expiryBadgeText = t.expiryBadge.replace('{minutes}', expiresInMinutes.toString());

   return (
      <EmailLayout preview={preview} common={common} isSecurityEmail={true}>
         <EmailHeader badge={t.badge} brandName={common.brandName} />
         <Section style={content}>
            <Heading as="h2" style={heading}>
               {t.heading}
            </Heading>

            <Text style={paragraph}>{greeting}</Text>
            <Text style={paragraph}>{t.body}</Text>

            {/* OTP Highlight Box */}
            <Section style={otpCard}>
               <Text style={otpCodeLabel}>{t.otpLabel}</Text>
               <Text style={otpCodeValue}>{otpCode}</Text>
               <div style={badgeContainer}>
                  <span style={expiryBadge}>{expiryBadgeText}</span>
               </div>
            </Section>

            {/* Security Advisory Alert Box */}
            <Section style={alertBox}>
               <Text style={alertText}>
                  <strong style={alertTitle}>{t.securityNoticeTitle}</strong>
                  <br />
                  {t.securityNoticeBody}
               </Text>
            </Section>

            <Text style={subText}>{t.disclaimerText}</Text>
         </Section>
      </EmailLayout>
   );
};

export default OtpEmail;

const content: React.CSSProperties = {
   padding: '16px 32px 32px 32px',
};

const heading: React.CSSProperties = {
   fontSize: '22px',
   fontWeight: '700',
   color: EMAIL_COLORS.textHeading,
   textAlign: 'center',
   margin: '0 0 16px 0',
   letterSpacing: '-0.3px',
};

const paragraph: React.CSSProperties = {
   fontSize: '15px',
   lineHeight: '24px',
   color: EMAIL_COLORS.textBody,
   margin: '10px 0',
   textAlign: 'center',
};

const otpCard: React.CSSProperties = {
   backgroundColor: EMAIL_COLORS.codeBoxBg,
   border: `1.5px dashed ${EMAIL_COLORS.borderDashed}`,
   borderRadius: '12px',
   padding: '24px 16px',
   textAlign: 'center',
   margin: '24px 0',
   boxShadow: EMAIL_COLORS.shadowOtp,
};

const otpCodeLabel: React.CSSProperties = {
   fontSize: '11px',
   fontWeight: '700',
   letterSpacing: '1px',
   color: EMAIL_COLORS.textMuted,
   margin: '0 0 10px 0',
   textTransform: 'uppercase',
};

const otpCodeValue: React.CSSProperties = {
   fontFamily: EMAIL_FONTS.mono,
   fontSize: '36px',
   fontWeight: '800',
   letterSpacing: '10px',
   color: EMAIL_COLORS.textHeading,
   margin: '0',
   paddingLeft: '10px',
   lineHeight: '1.2',
};

const badgeContainer: React.CSSProperties = {
   marginTop: '14px',
   textAlign: 'center',
};

const expiryBadge: React.CSSProperties = {
   display: 'inline-block',
   backgroundColor: EMAIL_COLORS.primaryLight,
   color: EMAIL_COLORS.primary,
   padding: '4px 12px',
   borderRadius: '9999px',
   fontSize: '12px',
   fontWeight: '600',
   border: `1px solid ${EMAIL_COLORS.primaryBorder}`,
};

const alertBox: React.CSSProperties = {
   backgroundColor: EMAIL_COLORS.warningBg,
   border: `1px solid ${EMAIL_COLORS.warningBorder}`,
   borderRadius: '10px',
   padding: '14px 16px',
   margin: '20px 0 16px 0',
};

const alertTitle: React.CSSProperties = {
   color: EMAIL_COLORS.warningText,
   fontSize: '13px',
};

const alertText: React.CSSProperties = {
   fontSize: '13px',
   lineHeight: '20px',
   color: EMAIL_COLORS.warningText,
   margin: 0,
};

const subText: React.CSSProperties = {
   fontSize: '13px',
   lineHeight: '20px',
   color: EMAIL_COLORS.textMuted,
   margin: '12px 0 0 0',
   textAlign: 'center',
};
