import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "./ui/Form.tsx";
import { Input } from "./ui/Input.tsx";
import { Button } from "./ui/Button.tsx";
import { Separator } from "./ui/Separator.tsx";
import { toast } from "../../hooks/useToast.ts";
import {
  singlefileConfigSchema,
  singlefileConfigInput,
  singlefileConfigType,
} from "../lib/validators/singlefileConfig.ts";
import {
  getSinglefileConfig,
  saveSinglefileConfig,
} from "../lib/singlefileConfig.ts";

const SinglefileSettings = () => {
  const form = useForm<singlefileConfigInput, unknown, singlefileConfigType>({
    resolver: zodResolver(singlefileConfigSchema),
    defaultValues: singlefileConfigSchema.parse({}),
  });

  useEffect(() => {
    void getSinglefileConfig().then((config) => form.reset(config));
  }, [form]);

  const { handleSubmit, control } = form;

  const onSubmit = async (values: singlefileConfigType) => {
    await saveSinglefileConfig(values);
    toast({
      title: "Saved",
      description: "SingleFile settings have been saved.",
      variant: "success",
    });
  };

  return (
    <div className="px-2 pb-2">
      <Separator className="my-3" />
      <h2 className="text-base font-medium">SingleFile</h2>
      <Form {...form}>
        <form
          onSubmit={handleSubmit((data) => onSubmit(data))}
          className="space-y-3 pt-2"
        >
          <FormField
            control={control}
            name="maxUploadMB"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max upload size (MB)</FormLabel>
                <FormDescription>
                  Captured snapshots larger than this are rejected before
                  upload. Raise this only if your Linkwarden server (and any
                  reverse proxy in front of it) accepts request bodies of this
                  size.
                </FormDescription>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    max={1024}
                    value={field.value as number}
                    onChange={(e) => field.onChange(e.target.value)}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default SinglefileSettings;
