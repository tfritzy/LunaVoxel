import { AccessType, DbConnection } from "@/module_bindings";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useEffect, useState } from "react";
import { RoleDropdown } from "./RoleDropdown";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  role: z.enum(["Read", "ReadWrite"]),
});

export const InviteForm = ({
  connection,
  projectId,
}: {
  connection: DbConnection;
  projectId: string;
}) => {
  const [placeholder, setPlaceholder] = useState("editor@example.com");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      role: "ReadWrite",
    },
  });

  useEffect(() => {
    const subscription = form.watch((values) => {
      if (values.role === "ReadWrite") {
        setPlaceholder("editor@example.com");
      } else {
        setPlaceholder("viewer@example.com");
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);

  useEffect(() => {
    if (form.formState.isSubmitSuccessful) {
      form.reset({
        email: "",
        role: form.getValues("role"),
      });
    }
  }, [form.formState.isSubmitSuccessful, form.reset, form.getValues]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    connection.reducers.inviteToProject(projectId, values.email, {
      tag: values.role,
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-full flex flex-row space-x-2 justify-between items-start"
      >
        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem className="h-full">
              <FormControl>
                <RoleDropdown
                  disabled={false}
                  role={field.value as AccessType["tag"]}
                  onRoleChange={field.onChange}
                  allowRemove={false}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormControl>
                <Input type="email" placeholder={placeholder} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" variant="outline">
          <Send className="w-4 h-4" />
          Invite
        </Button>
      </form>
    </Form>
  );
};
