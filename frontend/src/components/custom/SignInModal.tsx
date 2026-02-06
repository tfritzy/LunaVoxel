export const SignInModal = ({
  title,
  subheader,
  onSignIn,
}: {
  title: string;
  subheader: string;
  onSignIn: () => void;
}) => {
  return (
    <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background border border-border rounded-lg p-8 py-12 max-w-md w-full mx-4 pointer-events-auto shadow-2xl">
      <div className="space-y-6">
        <div className="ml-1">
          <h1 className="text-3xl font-bold text-foreground mb-3">{title}</h1>
          <div className="text-muted-foreground">{subheader}</div>
        </div>
        <div>
          <button
            onClick={onSignIn}
            className="flex flex-row cursor-pointer rounded items-center justify-center w-full border bg-background shadow-xs hover:bg-accent py-3 dark:bg-input/30 dark:border-input dark:hover:bg-input/50"
          >
            <span>Continue</span>
          </button>
        </div>
      </div>
    </div>
  );
};
