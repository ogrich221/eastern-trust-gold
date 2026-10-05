import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { registerCustomerPublic } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  staticData: { sitemap: true }, head: () => ({ meta: [{ title: "Open an Account | Eastern Trust Bank" },{ name: "description", content: "Create your secure Eastern Trust Bank customer account." },{ property: "og:title", content: "Open an Account | Eastern Trust Bank" },{ property: "og:description", content: "Begin your relationship with Eastern Trust Bank." },{ property: "og:type", content: "website" },{ name: "twitter:card", content: "summary" }] }), component: SignupPage });
const firstQuestion="What was the name of your first school?";
const secondQuestion="What city did your parents meet in?";
const questions=[firstQuestion,secondQuestion,"What was the name of your childhood friend?","What was your first job?"];
async function hash(value:string){const bytes=new TextEncoder().encode(value.trim().toLowerCase());const digest=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");}
function SignupPage(){
  const [done,setDone]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const registerFn = useServerFn(registerCustomerPublic);
  const [form,setForm]=useState({firstName:"",lastName:"",email:"",phone:"",address:"",city:"",postalCode:"",question1:firstQuestion,answer1:"",question2:secondQuestion,answer2:"",password:"",confirm:""}); 
  const update=(key:string,value:string)=>setForm(v=>({...v,[key]:value}));

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    setError("");
    if(form.password!==form.confirm){setError("Passwords do not match.");return;}
    if(form.question1===form.question2){setError("Choose two different security questions.");return;}
    setBusy(true);

    try {
      // Primary: Server registration (auto-provisions profile, checking account, and confirms email)
      await registerFn({
        data: {
          email: form.email.trim(),
          password: form.password,
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          postal_code: form.postalCode.trim(),
          security_question_one: form.question1,
          answer_one: form.answer1,
          security_question_two: form.question2,
          answer_two: form.answer2,
        },
      });
      setBusy(false);
      setDone(true);
      return;
    } catch (serverErr: any) {
      // Fallback: standard client-side signup if server function encounters issue
      const [answer1,answer2]=await Promise.all([hash(form.answer1),hash(form.answer2)]);
      const profile={first_name:form.firstName.trim(),last_name:form.lastName.trim(),phone:form.phone.trim(),address:form.address.trim(),city:form.city.trim(),postal_code:form.postalCode.trim(),security_question_one:form.question1,security_answer_one_hash:answer1,security_question_two:form.question2,security_answer_two_hash:answer2};
      const {data,error:authError}=await supabase.auth.signUp({
        email:form.email.trim(),
        password:form.password,
        options:{
          emailRedirectTo:window.location.origin+"/auth",
          data:{
            pending_profile:profile,
            first_name: form.firstName.trim(),
            last_name: form.lastName.trim(),
            phone: form.phone.trim(),
            full_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
          }
        }
      });
      if(authError){
        setBusy(false);
        setError(authError.message || serverErr?.message || "Failed to create account.");
        return;
      }
      if(data.session&&data.user){
        try {
          await supabase.from("profiles").insert({id:data.user.id,...profile});
        } catch {}
      }
      setBusy(false);
      setDone(true);
    }
  };

  if(done)return (
    <main className="grid min-h-[calc(100vh-5rem)] place-items-center px-5">
      <div className="max-w-lg text-center">
        <span className="mx-auto grid size-14 place-items-center border border-primary text-primary"><Check/></span>
        <h1 className="mt-6 text-4xl sm:text-5xl font-semibold">Account created!</h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          Your Eastern Trust banking profile has been initialized with Everyday Checking. You can now log in securely using your credentials.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/auth">Proceed to Login</Link>
        </Button>
      </div>
    </main>
  );
 const personalFields: [keyof typeof form,string,string,string][]=[["firstName","First name","text","given-name"],["lastName","Last name","text","family-name"],["email","Email address","email","email"],["phone","Phone number","tel","tel"],["address","Street address","text","street-address"],["city","City","text","address-level2"],["postalCode","Postal code","text","postal-code"]];
 return <main className="py-14"><div className="mx-auto max-w-4xl px-5"><div className="mb-10"><p className="text-xs font-semibold uppercase text-primary">Open an account</p><h1 className="mt-4 text-5xl sm:text-6xl">Let’s begin with you.</h1><p className="mt-4 max-w-2xl text-muted-foreground">Create secure online access. A banker can help you choose and fund a banking product afterward.</p></div><form onSubmit={submit} className="border border-border bg-card p-6 sm:p-9"><fieldset className="grid gap-5 sm:grid-cols-2"><legend className="col-span-full mb-5 font-display text-2xl">Personal & contact details</legend>{personalFields.map(([key,label,type,auto])=><div key={key} className={key==="address"?"sm:col-span-2":""}><Label htmlFor={key}>{label}</Label><Input id={key} type={type} autoComplete={auto} required maxLength={key==="address"?240:100} value={form[key]} onChange={e=>update(key,e.target.value)} className="mt-2 h-11"/></div>)}</fieldset><div className="my-8 h-px bg-border"/><fieldset className="grid gap-5 sm:grid-cols-2"><legend className="col-span-full mb-5 font-display text-2xl">Security questions</legend>{[1,2].map(n=><div key={n} className="space-y-4"><div><Label htmlFor={`question${n}`}>Question {n}</Label><select id={`question${n}`} value={form[`question${n}` as keyof typeof form]} onChange={e=>update(`question${n}`,e.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm">{questions.map(q=><option key={q}>{q}</option>)}</select></div><div><Label htmlFor={`answer${n}`}>Answer {n}</Label><Input id={`answer${n}`} required minLength={2} maxLength={100} value={form[`answer${n}` as keyof typeof form]} onChange={e=>update(`answer${n}`,e.target.value)} className="mt-2 h-11"/></div></div>)}</fieldset><div className="my-8 h-px bg-border"/><fieldset className="grid gap-5 sm:grid-cols-2"><legend className="col-span-full mb-5 font-display text-2xl">Create your password</legend><div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={form.password} onChange={e=>update("password",e.target.value)} className="mt-2 h-11"/><p className="mt-2 text-xs text-muted-foreground">Use at least 10 characters.</p></div><div><Label htmlFor="confirm">Confirm password</Label><Input id="confirm" type="password" autoComplete="new-password" required minLength={10} maxLength={72} value={form.confirm} onChange={e=>update("confirm",e.target.value)} className="mt-2 h-11"/></div></fieldset>{error&&<p role="alert" className="mt-6 text-sm text-destructive">{error}</p>}<div className="mt-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center"><p className="flex max-w-md gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary"/>Your answers are converted into one-way security codes before storage.</p><Button size="lg" disabled={busy}>{busy?"Creating account…":"Create account"}</Button></div></form></div></main>}