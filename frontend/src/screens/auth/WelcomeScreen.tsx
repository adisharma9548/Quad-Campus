import React from 'react';
import { UserPlus, LogIn } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { AuthSplitLayout } from '../../components/AuthSplitLayout';
import { useInstitution } from '../../context/ConfigContext';

export default function WelcomeScreen({
  onNavigate,
}: {
  onNavigate: (screen: string) => void;
}) {
  const institution = useInstitution();
  return (
    <AuthSplitLayout>
      <Card className="p-6 sm:p-8 space-y-6">
        <div className="text-center lg:text-left">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-ink font-display">
            Get started on {institution.appName}
          </h2>
          <p className="text-sm text-ink/60 mt-1 leading-relaxed">
            {institution.tagline}
          </p>
        </div>

        <div className="space-y-3">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            icon={UserPlus}
            onClick={() => onNavigate?.('signup')}
          >
            Create account
          </Button>

          <Button
            variant="secondary"
            size="lg"
            fullWidth
            icon={LogIn}
            onClick={() => onNavigate?.('login')}
          >
            Log in
          </Button>
        </div>

        <div className="pt-4 border-t border-ink/12">
          <p className="text-xs text-center lg:text-left text-ink/60 leading-relaxed">
            By continuing, you agree to Quad's{' '}
            <button
              type="button"
              onClick={() => onNavigate?.('terms')}
              className="text-accent font-semibold underline underline-offset-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[8px]"
            >
              Terms & Conditions and Privacy Policy
            </button>
            .
          </p>
        </div>
      </Card>
    </AuthSplitLayout>
  );
}
