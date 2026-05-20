import React, { forwardRef } from "react";

export const VirtuosoTable = forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  (props, ref) => <table {...props} ref={ref} className="w-full text-sm" />
);
VirtuosoTable.displayName = "VirtuosoTable";

export const VirtuosoTableHead = forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  (props, ref) => <thead {...props} ref={ref} className="bg-background sticky top-0 z-10" />
);
VirtuosoTableHead.displayName = "VirtuosoTableHead";
