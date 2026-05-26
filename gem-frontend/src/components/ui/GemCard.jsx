import { Card, CardContent } from "@mui/material";

export default function GemCard({ children, sx, contentSx, ...rest }) {
  return (
    <Card sx={sx} {...rest}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 }, ...contentSx }}>
        {children}
      </CardContent>
    </Card>
  );
}
